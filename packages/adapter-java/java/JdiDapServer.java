import com.sun.jdi.*;
import com.sun.jdi.connect.*;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

/**
 * Minimal DAP server using JDI (Java Debug Interface).
 *
 * Usage:
 *   java JdiDapServer --port <port>
 *
 * Speaks Debug Adapter Protocol over TCP with Content-Length framing.
 * Uses JDI internally to debug a target JVM (attach or launch).
 *
 * Zero external dependencies — JDI ships with every JDK.
 */
public class JdiDapServer {

    // --- DAP sequence counter ---
    private final AtomicInteger seq = new AtomicInteger(1);

    // --- JDI state ---
    private VirtualMachine vm;
    private Process launchedProcess; // non-null only in launch mode

    // --- Variable references ---
    // All variable references (scopes, expandable objects) use sequential IDs
    // starting from 1. Maps track what each ref points to.
    private final AtomicInteger nextVarRef = new AtomicInteger(1);
    private final ConcurrentHashMap<Integer, ObjectReference> varRefMap = new ConcurrentHashMap<>();
    // Scope refs map to (threadId, frameIndex) for lazy variable loading
    private final ConcurrentHashMap<Integer, long[]> scopeRefMap = new ConcurrentHashMap<>();
    // Cache stack frames per thread for variable lookup
    private final ConcurrentHashMap<Long, List<StackFrame>> threadFrameCache = new ConcurrentHashMap<>();

    // --- Deferred breakpoints (class not yet loaded) ---
    // Map: source path basename (e.g. "HelloWorld.java") -> list of line numbers
    private final ConcurrentHashMap<String, Map<String, Object>> deferredBreakpoints = new ConcurrentHashMap<>();
    // Track source paths for deferred breakpoint responses
    private final ConcurrentHashMap<String, String> sourcePathMap = new ConcurrentHashMap<>();

    // --- IO ---
    private OutputStream clientOut;
    private volatile boolean running = true;
    private boolean configurationDone = false;
    private boolean launchSuspended = false; // true if we launched with suspend=y
    private boolean stopOnEntry = true; // whether to stop on entry in launch mode

    // --- Logging ---
    private static boolean debug = false;

    public static void main(String[] args) throws Exception {
        int port = 0;
        for (int i = 0; i < args.length; i++) {
            if ("--port".equals(args[i]) && i + 1 < args.length) {
                port = Integer.parseInt(args[i + 1]);
                i++;
            } else if ("--debug".equals(args[i])) {
                debug = true;
            }
        }
        if (port == 0) {
            System.err.println("Usage: java JdiDapServer --port <port>");
            System.exit(1);
        }

        new JdiDapServer().run(port);
    }

    private void run(int port) throws Exception {
        try (ServerSocket serverSocket = new ServerSocket(port, 1, InetAddress.getLoopbackAddress())) {
            log("JdiDapServer listening on port " + port);
            Socket client = serverSocket.accept();
            log("Client connected");

            InputStream in = client.getInputStream();
            clientOut = client.getOutputStream();

            // Read DAP messages
            while (running) {
                Map<String, Object> msg = readDapMessage(in);
                if (msg == null) {
                    log("Client disconnected (EOF)");
                    break;
                }
                handleMessage(msg);
            }
        } catch (SocketException e) {
            if (running) log("Socket error: " + e.getMessage());
        } finally {
            cleanup();
        }
    }

    // ========== DAP Transport ==========

    private Map<String, Object> readDapMessage(InputStream in) throws IOException {
        // Read Content-Length header
        String line;
        int contentLength = -1;
        while ((line = readLine(in)) != null) {
            if (line.isEmpty()) break; // empty line separates header from body
            if (line.startsWith("Content-Length:")) {
                contentLength = Integer.parseInt(line.substring(15).trim());
            }
        }
        if (contentLength < 0) return null;

        // Read body
        byte[] body = new byte[contentLength];
        int read = 0;
        while (read < contentLength) {
            int n = in.read(body, read, contentLength - read);
            if (n < 0) return null;
            read += n;
        }

        String json = new String(body, StandardCharsets.UTF_8);
        logVerbose("<<< " + json);
        return parseJson(json);
    }

    private String readLine(InputStream in) throws IOException {
        StringBuilder sb = new StringBuilder();
        int c;
        while ((c = in.read()) >= 0) {
            if (c == '\r') {
                int next = in.read();
                if (next == '\n') break;
                sb.append((char) c);
                if (next >= 0) sb.append((char) next);
            } else if (c == '\n') {
                break;
            } else {
                sb.append((char) c);
            }
        }
        if (c < 0 && sb.length() == 0) return null;
        return sb.toString();
    }

    private synchronized void sendDapMessage(Map<String, Object> msg) {
        try {
            if (clientOut == null) return;
            String json = toJson(msg);
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            String header = "Content-Length: " + bytes.length + "\r\n\r\n";
            clientOut.write(header.getBytes(StandardCharsets.UTF_8));
            clientOut.write(bytes);
            clientOut.flush();
            logVerbose(">>> " + json);
        } catch (IOException e) {
            log("Send error: " + e.getMessage());
        }
    }

    // ========== Message Handling ==========

    private void handleMessage(Map<String, Object> msg) {
        String type = str(msg, "type");
        if (!"request".equals(type)) return;

        String command = str(msg, "command");
        int reqSeq = intVal(msg, "seq");
        Map<String, Object> args = map(msg, "arguments");
        if (args == null) args = new HashMap<>();

        try {
            switch (command) {
                case "initialize": handleInitialize(reqSeq, args); break;
                case "attach": handleAttach(reqSeq, args); break;
                case "launch": handleLaunch(reqSeq, args); break;
                case "setBreakpoints": handleSetBreakpoints(reqSeq, args); break;
                case "configurationDone": handleConfigurationDone(reqSeq, args); break;
                case "threads": handleThreads(reqSeq, args); break;
                case "stackTrace": handleStackTrace(reqSeq, args); break;
                case "scopes": handleScopes(reqSeq, args); break;
                case "variables": handleVariables(reqSeq, args); break;
                case "continue": handleContinue(reqSeq, args); break;
                case "next": handleStep(reqSeq, args, StepRequest.STEP_OVER); break;
                case "stepIn": handleStep(reqSeq, args, StepRequest.STEP_INTO); break;
                case "stepOut": handleStep(reqSeq, args, StepRequest.STEP_OUT); break;
                case "disconnect": handleDisconnect(reqSeq, args); break;
                case "evaluate": handleEvaluate(reqSeq, args); break;
                case "setExceptionBreakpoints": handleSetExceptionBreakpoints(reqSeq, args); break;
                case "source": sendResponse(reqSeq, command, true, mapOf("content", "")); break;
                default:
                    log("Unhandled command: " + command);
                    sendResponse(reqSeq, command, true, new HashMap<>());
                    break;
            }
        } catch (Exception e) {
            log("Error handling " + command + ": " + e.getMessage());
            sendErrorResponse(reqSeq, command, e.getMessage());
        }
    }

    // ========== DAP Handlers ==========

    private void handleInitialize(int reqSeq, Map<String, Object> args) {
        Map<String, Object> caps = new HashMap<>();
        caps.put("supportsConfigurationDoneRequest", true);
        caps.put("supportsFunctionBreakpoints", false);
        caps.put("supportsConditionalBreakpoints", true);
        caps.put("supportsEvaluateForHovers", true);
        caps.put("supportsSetVariable", false);
        caps.put("supportsStepInTargetsRequest", false);
        caps.put("supportsCompletionsRequest", false);
        caps.put("supportsTerminateRequest", true);
        caps.put("supportsDelayedStackTraceLoading", false);
        caps.put("supportsExceptionInfoRequest", false);
        caps.put("supportsHitConditionalBreakpoints", false);
        caps.put("supportsLogPoints", false);
        sendResponse(reqSeq, "initialize", true, caps);
        sendEvent("initialized", new HashMap<>());
    }

    private void handleAttach(int reqSeq, Map<String, Object> args) throws Exception {
        String host = strOr(args, "host", strOr(args, "hostName", "localhost"));
        int port = intVal(args, "port");
        if (port == 0) {
            sendErrorResponse(reqSeq, "attach", "Port is required for attach");
            return;
        }

        log("Attaching to " + host + ":" + port);
        AttachingConnector connector = findAttachConnector();
        Map<String, Connector.Argument> connArgs = connector.defaultArguments();
        connArgs.get("hostname").setValue(host);
        connArgs.get("port").setValue(String.valueOf(port));

        vm = connector.attach(connArgs);
        log("Attached to VM: " + vm.description());

        startEventLoop();
        registerPendingBreakpoints();
        sendResponse(reqSeq, "attach", true, new HashMap<>());
    }

    private void handleLaunch(int reqSeq, Map<String, Object> args) throws Exception {
        String mainClass = str(args, "mainClass");
        if (mainClass == null || mainClass.isEmpty()) {
            sendErrorResponse(reqSeq, "launch", "mainClass is required");
            return;
        }

        String classpath = strOr(args, "classpath", ".");
        this.stopOnEntry = boolVal(args, "stopOnEntry", true);

        // Find a free port for JDWP
        int jdwpPort;
        try (ServerSocket ss = new ServerSocket(0)) {
            jdwpPort = ss.getLocalPort();
        }

        // Build java command
        String javaCmd = strOr(args, "javaPath", findJava());
        List<String> cmdList = new ArrayList<>();
        cmdList.add(javaCmd);
        cmdList.add("-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=*:" + jdwpPort);

        // Add VM args if provided
        String vmArgs = str(args, "vmArgs");
        if (vmArgs != null && !vmArgs.isEmpty()) {
            for (String arg : vmArgs.split("\\s+")) {
                if (!arg.isEmpty()) cmdList.add(arg);
            }
        }

        cmdList.add("-cp");
        cmdList.add(classpath);
        cmdList.add(mainClass);

        // Add program args if provided
        Object progArgs = args.get("args");
        if (progArgs instanceof List) {
            for (Object a : (List<?>) progArgs) {
                cmdList.add(String.valueOf(a));
            }
        }

        log("Launching: " + String.join(" ", cmdList));
        ProcessBuilder pb = new ProcessBuilder(cmdList);
        pb.redirectErrorStream(false);
        launchedProcess = pb.start();

        // Read stderr to find JDWP listen port (and forward output)
        Thread stderrThread = new Thread(() -> {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(launchedProcess.getErrorStream()))) {
                String line;
                while ((line = br.readLine()) != null) {
                    log("[target stderr] " + line);
                    sendOutputEvent("stderr", line + "\n");
                }
            } catch (IOException e) { /* ignore */ }
        }, "target-stderr");
        stderrThread.setDaemon(true);
        stderrThread.start();

        // Forward stdout
        Thread stdoutThread = new Thread(() -> {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(launchedProcess.getInputStream()))) {
                String line;
                while ((line = br.readLine()) != null) {
                    sendOutputEvent("stdout", line + "\n");
                }
            } catch (IOException e) { /* ignore */ }
        }, "target-stdout");
        stdoutThread.setDaemon(true);
        stdoutThread.start();

        // Wait briefly for JDWP to start, then attach
        Thread.sleep(500);

        // Attach via JDI
        AttachingConnector connector = findAttachConnector();
        Map<String, Connector.Argument> connArgs = connector.defaultArguments();
        connArgs.get("hostname").setValue("localhost");
        connArgs.get("port").setValue(String.valueOf(jdwpPort));

        // Retry attach for up to 10 seconds
        long deadline = System.currentTimeMillis() + 10000;
        while (true) {
            try {
                vm = connector.attach(connArgs);
                break;
            } catch (ConnectException e) {
                if (System.currentTimeMillis() > deadline) throw e;
                Thread.sleep(200);
            }
        }

        log("Attached to launched VM on port " + jdwpPort);
        launchSuspended = true;

        startEventLoop();
        registerPendingBreakpoints();

        if (stopOnEntry) {
            // VM is already suspended from suspend=y
            // We'll send stopped event after configurationDone
        }

        sendResponse(reqSeq, "launch", true, new HashMap<>());
    }

    /**
     * Register ClassPrepareRequests for any breakpoints that were set before the VM connected.
     * Also resolves breakpoints for classes that are already loaded.
     */
    private void registerPendingBreakpoints() {
        if (vm == null || deferredBreakpoints.isEmpty()) return;

        for (Map.Entry<String, Map<String, Object>> entry : deferredBreakpoints.entrySet()) {
            String className = entry.getKey();
            Map<String, Object> bpInfo = entry.getValue();
            String sourcePath = str(bpInfo, "sourcePath");
            List<Object> breakpointSpecs = list(bpInfo, "breakpoints");
            if (breakpointSpecs == null) continue;

            String fileName = className + ".java";

            // Check if the class is already loaded (by simple name or source file)
            ReferenceType found = findLoadedClass(className, fileName);

            if (found != null) {
                // Class already loaded — set breakpoints directly
                log("Setting pending breakpoints on already-loaded " + found.name());
                for (Object bpObj : breakpointSpecs) {
                    Map<String, Object> bpSpec = asMap(bpObj);
                    int line = intVal(bpSpec, "line");
                    String condition = str(bpSpec, "condition");
                    setBreakpointOnClass(found, line, condition, sourcePath);
                }
            } else {
                // Not loaded — register ClassPrepareRequest
                EventRequestManager erm = vm.eventRequestManager();
                ClassPrepareRequest cpr = erm.createClassPrepareRequest();
                cpr.addClassFilter("*" + className);
                cpr.putProperty("jdi-bp-class", className);
                cpr.setSuspendPolicy(EventRequest.SUSPEND_ALL);
                cpr.enable();
                log("Registered deferred ClassPrepareRequest for *" + className);
            }
        }
    }

    /**
     * Find a loaded class by simple name or source file name.
     * Handles package-qualified classes (e.g., com.example.MyClass) that
     * won't be found by vm.classesByName("MyClass").
     */
    private ReferenceType findLoadedClass(String className, String fileName) {
        // Try exact name first (works for default package)
        List<ReferenceType> classes = vm.classesByName(className);
        if (!classes.isEmpty()) return classes.get(0);

        // Search by source file name (handles package-qualified classes)
        for (ReferenceType rt : vm.allClasses()) {
            try {
                if (fileName.equals(rt.sourceName())) {
                    return rt;
                }
            } catch (AbsentInformationException e) {
                // Skip classes without source info
            }
        }
        return null;
    }

    private void handleSetBreakpoints(int reqSeq, Map<String, Object> args) {
        Map<String, Object> source = map(args, "source");
        String sourcePath = source != null ? str(source, "path") : null;
        List<Object> breakpointSpecs = list(args, "breakpoints");

        List<Map<String, Object>> results = new ArrayList<>();

        if (sourcePath == null || breakpointSpecs == null) {
            sendResponse(reqSeq, "setBreakpoints", true, mapOf("breakpoints", results));
            return;
        }

        // Extract class name from source path
        String fileName = new File(sourcePath).getName();
        String className = fileName.replace(".java", "");

        // Clear existing breakpoints for this source file
        if (vm != null) {
            EventRequestManager erm = vm.eventRequestManager();
            List<BreakpointRequest> toRemove = new ArrayList<>();
            for (BreakpointRequest br : erm.breakpointRequests()) {
                try {
                    Location loc = br.location();
                    String srcName = loc.sourceName();
                    if (fileName.equals(srcName)) {
                        toRemove.add(br);
                    }
                } catch (AbsentInformationException e) {
                    // Can't determine source, skip
                }
            }
            for (BreakpointRequest br : toRemove) {
                erm.deleteEventRequest(br);
            }
        }

        // Remove any existing class prepare requests for this class
        if (vm != null) {
            EventRequestManager erm = vm.eventRequestManager();
            List<ClassPrepareRequest> toRemove = new ArrayList<>();
            for (ClassPrepareRequest cpr : erm.classPrepareRequests()) {
                // Check if this CPR was for our class by looking at the property we set
                Object prop = cpr.getProperty("jdi-bp-class");
                if (className.equals(prop)) {
                    toRemove.add(cpr);
                }
            }
            for (ClassPrepareRequest cpr : toRemove) {
                erm.deleteEventRequest(cpr);
            }
        }

        // Store breakpoint specs for deferred setting
        Map<String, Object> bpInfo = new HashMap<>();
        bpInfo.put("sourcePath", sourcePath);
        bpInfo.put("breakpoints", breakpointSpecs);
        deferredBreakpoints.put(className, bpInfo);
        sourcePathMap.put(className, sourcePath);

        // Try to set breakpoints on already-loaded classes
        boolean classLoaded = false;
        if (vm != null) {
            ReferenceType refType = findLoadedClass(className, fileName);

            if (refType != null) {
                classLoaded = true;
                for (Object bpObj : breakpointSpecs) {
                    Map<String, Object> bpSpec = asMap(bpObj);
                    int line = intVal(bpSpec, "line");
                    String condition = str(bpSpec, "condition");
                    Map<String, Object> bp = setBreakpointOnClass(refType, line, condition, sourcePath);
                    results.add(bp);
                }
            }
        }

        if (!classLoaded) {
            // Class not loaded — register ClassPrepareRequest
            if (vm != null) {
                EventRequestManager erm = vm.eventRequestManager();
                ClassPrepareRequest cpr = erm.createClassPrepareRequest();
                cpr.addClassFilter("*" + className);
                cpr.putProperty("jdi-bp-class", className);
                cpr.setSuspendPolicy(EventRequest.SUSPEND_ALL);
                cpr.enable();
                log("Registered ClassPrepareRequest for *" + className);
            }

            // Return unverified breakpoints
            for (Object bpObj : breakpointSpecs) {
                Map<String, Object> bpSpec = asMap(bpObj);
                int line = intVal(bpSpec, "line");
                Map<String, Object> bp = new HashMap<>();
                bp.put("verified", false);
                bp.put("line", line);
                bp.put("message", "Class not yet loaded, breakpoint pending");
                bp.put("source", mapOf("path", sourcePath));
                results.add(bp);
            }
        }

        sendResponse(reqSeq, "setBreakpoints", true, mapOf("breakpoints", results));
    }

    private Map<String, Object> setBreakpointOnClass(ReferenceType refType, int line, String condition, String sourcePath) {
        Map<String, Object> bp = new HashMap<>();
        try {
            List<Location> locs = refType.locationsOfLine(line);
            if (locs.isEmpty()) {
                bp.put("verified", false);
                bp.put("line", line);
                bp.put("message", "No executable code at line " + line);
                return bp;
            }

            EventRequestManager erm = vm.eventRequestManager();
            BreakpointRequest bpr = erm.createBreakpointRequest(locs.get(0));
            if (condition != null && !condition.isEmpty()) {
                // JDI doesn't support conditional breakpoints natively,
                // but we store the condition and evaluate it on hit
                bpr.putProperty("condition", condition);
            }
            bpr.setSuspendPolicy(EventRequest.SUSPEND_ALL);
            bpr.enable();

            bp.put("verified", true);
            bp.put("line", locs.get(0).lineNumber());
            if (sourcePath != null) {
                bp.put("source", mapOf("path", sourcePath));
            }
            log("Breakpoint set at " + refType.name() + ":" + line);
        } catch (AbsentInformationException e) {
            bp.put("verified", false);
            bp.put("line", line);
            bp.put("message", "No debug info for class (compile with -g)");
        }
        return bp;
    }

    private void handleConfigurationDone(int reqSeq, Map<String, Object> args) {
        configurationDone = true;
        sendResponse(reqSeq, "configurationDone", true, new HashMap<>());

        if (launchSuspended) {
            launchSuspended = false;

            if (stopOnEntry) {
                // stopOnEntry=true: send stopped event, keep VM suspended
                long threadId = 1;
                try {
                    for (ThreadReference tr : vm.allThreads()) {
                        if ("main".equals(tr.name())) {
                            threadId = tr.uniqueID();
                            break;
                        }
                    }
                } catch (Exception e) { /* use default */ }

                sendStoppedEvent("entry", threadId);
            } else {
                // stopOnEntry=false: resume the VM so breakpoints can fire
                try {
                    vm.resume();
                } catch (Exception e) {
                    log("Error resuming VM after configurationDone: " + e.getMessage());
                }
            }
        }
    }

    private void handleThreads(int reqSeq, Map<String, Object> args) {
        List<Map<String, Object>> threads = new ArrayList<>();
        if (vm != null) {
            try {
                for (ThreadReference tr : vm.allThreads()) {
                    Map<String, Object> t = new HashMap<>();
                    t.put("id", (int) tr.uniqueID());
                    t.put("name", tr.name());
                    threads.add(t);
                }
            } catch (VMDisconnectedException e) {
                // VM already gone
            }
        }
        sendResponse(reqSeq, "threads", true, mapOf("threads", threads));
    }

    private void handleStackTrace(int reqSeq, Map<String, Object> args) {
        int threadId = intVal(args, "threadId");
        List<Map<String, Object>> frames = new ArrayList<>();

        if (vm != null) {
            try {
                ThreadReference thread = findThread(threadId);
                if (thread != null) {
                    List<StackFrame> jdiFrames = thread.frames();
                    // Cache frames for variable lookup
                    threadFrameCache.put(thread.uniqueID(), jdiFrames);

                    for (int i = 0; i < jdiFrames.size(); i++) {
                        StackFrame sf = jdiFrames.get(i);
                        Location loc = sf.location();
                        int frameId = encodeFrameId(threadId, i);

                        Map<String, Object> frame = new HashMap<>();
                        frame.put("id", frameId);
                        frame.put("name", loc.method().name());
                        frame.put("line", loc.lineNumber());
                        frame.put("column", 0);

                        // Source info
                        Map<String, Object> source = new HashMap<>();
                        try {
                            source.put("name", loc.sourceName());
                            source.put("path", resolveSourcePath(loc));
                        } catch (AbsentInformationException e) {
                            source.put("name", loc.declaringType().name());
                        }
                        frame.put("source", source);

                        frames.add(frame);
                    }
                }
            } catch (IncompatibleThreadStateException e) {
                log("Thread not suspended for stack trace: " + e.getMessage());
            } catch (VMDisconnectedException e) {
                // VM already gone
            }
        }

        Map<String, Object> body = new HashMap<>();
        body.put("stackFrames", frames);
        body.put("totalFrames", frames.size());
        sendResponse(reqSeq, "stackTrace", true, body);
    }

    private void handleScopes(int reqSeq, Map<String, Object> args) {
        int frameId = intVal(args, "frameId");
        List<Map<String, Object>> scopes = new ArrayList<>();

        // Decode frameId to get threadId and frameIndex
        int threadId = frameId / 100000;
        int frameIndex = frameId % 100000;

        // Allocate a scope reference and track what it points to
        int scopeRef = nextVarRef.getAndIncrement();
        scopeRefMap.put(scopeRef, new long[]{threadId, frameIndex});

        // Locals scope
        Map<String, Object> locals = new HashMap<>();
        locals.put("name", "Locals");
        locals.put("variablesReference", scopeRef);
        locals.put("expensive", false);
        scopes.add(locals);

        sendResponse(reqSeq, "scopes", true, mapOf("scopes", scopes));
    }

    private void handleVariables(int reqSeq, Map<String, Object> args) {
        int varRef = intVal(args, "variablesReference");
        List<Map<String, Object>> variables = new ArrayList<>();

        if (vm != null) {
            try {
                // Check if this is a scope reference (locals for a frame)
                long[] scopeInfo = scopeRefMap.get(varRef);
                if (scopeInfo != null) {
                    int threadId = (int) scopeInfo[0];
                    int frameIndex = (int) scopeInfo[1];

                    ThreadReference thread = findThread(threadId);
                    if (thread != null) {
                        List<StackFrame> cachedFrames = threadFrameCache.get(thread.uniqueID());
                        if (cachedFrames != null && frameIndex < cachedFrames.size()) {
                            StackFrame sf = cachedFrames.get(frameIndex);
                            variables = getFrameVariables(sf);
                        }
                    }
                } else {
                    // Expandable object reference
                    ObjectReference objRef = varRefMap.get(varRef);
                    if (objRef != null) {
                        variables = getObjectFields(objRef);
                    }
                }
            } catch (Exception e) {
                log("Error getting variables: " + e.getMessage());
            }
        }

        sendResponse(reqSeq, "variables", true, mapOf("variables", variables));
    }

    private List<Map<String, Object>> getFrameVariables(StackFrame sf) {
        List<Map<String, Object>> vars = new ArrayList<>();
        try {
            List<LocalVariable> locals = sf.visibleVariables();
            Map<LocalVariable, Value> values = sf.getValues(locals);
            for (LocalVariable lv : locals) {
                Value val = values.get(lv);
                vars.add(makeVariable(lv.name(), lv.typeName(), val));
            }

            // Add 'this' if available
            try {
                ObjectReference thisObj = sf.thisObject();
                if (thisObj != null) {
                    vars.add(makeVariable("this", thisObj.referenceType().name(), thisObj));
                }
            } catch (Exception e) { /* static method, no this */ }
        } catch (AbsentInformationException e) {
            Map<String, Object> v = new HashMap<>();
            v.put("name", "<no debug info>");
            v.put("value", "Compile with javac -g to see variables");
            v.put("variablesReference", 0);
            vars.add(v);
        } catch (InvalidStackFrameException e) {
            // Frame became invalid (thread resumed)
        }
        return vars;
    }

    private List<Map<String, Object>> getObjectFields(ObjectReference objRef) {
        List<Map<String, Object>> vars = new ArrayList<>();
        try {
            ReferenceType type = objRef.referenceType();
            for (Field field : type.allFields()) {
                if (field.isStatic()) continue; // skip static fields by default
                Value val = objRef.getValue(field);
                vars.add(makeVariable(field.name(), field.typeName(), val));
            }
        } catch (Exception e) {
            log("Error getting object fields: " + e.getMessage());
        }
        return vars;
    }

    private Map<String, Object> makeVariable(String name, String typeName, Value val) {
        Map<String, Object> v = new HashMap<>();
        v.put("name", name);
        v.put("type", typeName);

        if (val == null) {
            v.put("value", "null");
            v.put("variablesReference", 0);
        } else if (val instanceof PrimitiveValue) {
            v.put("value", val.toString());
            v.put("variablesReference", 0);
        } else if (val instanceof StringReference) {
            v.put("value", "\"" + ((StringReference) val).value() + "\"");
            v.put("variablesReference", 0);
        } else if (val instanceof ArrayReference) {
            ArrayReference arr = (ArrayReference) val;
            int ref = nextVarRef.getAndIncrement();
            varRefMap.put(ref, arr);
            v.put("value", typeName + "[" + arr.length() + "]");
            v.put("variablesReference", ref);
            v.put("indexedVariables", arr.length());
        } else if (val instanceof ObjectReference) {
            ObjectReference obj = (ObjectReference) val;
            int ref = nextVarRef.getAndIncrement();
            varRefMap.put(ref, obj);
            // Try toString for a preview
            String preview = obj.referenceType().name() + "@" + obj.uniqueID();
            v.put("value", preview);
            v.put("variablesReference", ref);
        } else {
            v.put("value", val.toString());
            v.put("variablesReference", 0);
        }

        return v;
    }

    private void handleContinue(int reqSeq, Map<String, Object> args) {
        clearFrameCache();
        if (vm != null) {
            try {
                vm.resume();
            } catch (VMDisconnectedException e) {
                // VM already gone
            }
        }
        Map<String, Object> body = new HashMap<>();
        body.put("allThreadsContinued", true);
        sendResponse(reqSeq, "continue", true, body);
    }

    private void handleStep(int reqSeq, Map<String, Object> args, int depth) {
        int threadId = intVal(args, "threadId");
        clearFrameCache();

        if (vm != null) {
            try {
                ThreadReference thread = findThread(threadId);
                if (thread != null) {
                    EventRequestManager erm = vm.eventRequestManager();
                    StepRequest stepReq = erm.createStepRequest(thread, StepRequest.STEP_LINE, depth);
                    stepReq.addCountFilter(1);
                    stepReq.setSuspendPolicy(EventRequest.SUSPEND_ALL);
                    stepReq.enable();
                    vm.resume();
                }
            } catch (Exception e) {
                log("Step error: " + e.getMessage());
            }
        }
        sendResponse(reqSeq, stepCommandName(depth), true, new HashMap<>());
    }

    private void handleDisconnect(int reqSeq, Map<String, Object> args) {
        sendResponse(reqSeq, "disconnect", true, new HashMap<>());
        cleanup();
        running = false;
    }

    private void handleEvaluate(int reqSeq, Map<String, Object> args) {
        String expression = str(args, "expression");
        Integer frameIdObj = intValOrNull(args, "frameId");

        if (vm == null || expression == null) {
            sendErrorResponse(reqSeq, "evaluate", "No active debug session");
            return;
        }

        try {
            // Try to evaluate as a local variable name or simple field access
            if (frameIdObj != null) {
                int frameId = frameIdObj;
                int threadId = frameId / 100000;
                int frameIndex = frameId % 100000;

                ThreadReference thread = findThread(threadId);
                if (thread != null) {
                    List<StackFrame> cachedFrames = threadFrameCache.get(thread.uniqueID());
                    if (cachedFrames != null && frameIndex < cachedFrames.size()) {
                        StackFrame sf = cachedFrames.get(frameIndex);

                        // Simple variable lookup
                        try {
                            LocalVariable lv = sf.visibleVariableByName(expression);
                            if (lv != null) {
                                Value val = sf.getValue(lv);
                                Map<String, Object> result = makeVariable(expression, lv.typeName(), val);
                                Map<String, Object> body = new HashMap<>();
                                body.put("result", str(result, "value"));
                                body.put("type", str(result, "type"));
                                body.put("variablesReference", result.get("variablesReference"));
                                sendResponse(reqSeq, "evaluate", true, body);
                                return;
                            }
                        } catch (AbsentInformationException e) { /* fall through */ }

                        // Try 'this' reference
                        if ("this".equals(expression)) {
                            try {
                                ObjectReference thisObj = sf.thisObject();
                                if (thisObj != null) {
                                    Map<String, Object> result = makeVariable("this", thisObj.referenceType().name(), thisObj);
                                    Map<String, Object> body = new HashMap<>();
                                    body.put("result", str(result, "value"));
                                    body.put("type", str(result, "type"));
                                    body.put("variablesReference", result.get("variablesReference"));
                                    sendResponse(reqSeq, "evaluate", true, body);
                                    return;
                                }
                            } catch (Exception e) { /* fall through */ }
                        }

                        // Simple field access: expr.field
                        int dot = expression.lastIndexOf('.');
                        if (dot > 0) {
                            String objName = expression.substring(0, dot);
                            String fieldName = expression.substring(dot + 1);
                            try {
                                LocalVariable lv = sf.visibleVariableByName(objName);
                                if (lv != null) {
                                    Value objVal = sf.getValue(lv);
                                    if (objVal instanceof ObjectReference) {
                                        ObjectReference objRef = (ObjectReference) objVal;
                                        Field field = objRef.referenceType().fieldByName(fieldName);
                                        if (field != null) {
                                            Value fieldVal = objRef.getValue(field);
                                            Map<String, Object> result = makeVariable(expression, field.typeName(), fieldVal);
                                            Map<String, Object> body = new HashMap<>();
                                            body.put("result", str(result, "value"));
                                            body.put("type", str(result, "type"));
                                            body.put("variablesReference", result.get("variablesReference"));
                                            sendResponse(reqSeq, "evaluate", true, body);
                                            return;
                                        }
                                    }
                                }
                            } catch (AbsentInformationException e) { /* fall through */ }
                        }
                    }
                }
            }

            sendErrorResponse(reqSeq, "evaluate", "Cannot evaluate expression: " + expression);
        } catch (Exception e) {
            sendErrorResponse(reqSeq, "evaluate", "Evaluation error: " + e.getMessage());
        }
    }

    private void handleSetExceptionBreakpoints(int reqSeq, Map<String, Object> args) {
        // Basic exception breakpoint support
        List<Object> filters = list(args, "filters");
        if (vm != null) {
            EventRequestManager erm = vm.eventRequestManager();
            // Remove existing exception requests
            for (ExceptionRequest er : new ArrayList<>(erm.exceptionRequests())) {
                erm.deleteEventRequest(er);
            }

            if (filters != null) {
                for (Object f : filters) {
                    String filter = String.valueOf(f);
                    boolean caught = "caught".equals(filter);
                    boolean uncaught = "uncaught".equals(filter);
                    if (caught || uncaught) {
                        ExceptionRequest er = erm.createExceptionRequest(null, caught, uncaught);
                        er.setSuspendPolicy(EventRequest.SUSPEND_ALL);
                        er.enable();
                    }
                }
            }
        }
        sendResponse(reqSeq, "setExceptionBreakpoints", true, new HashMap<>());
    }

    // ========== JDI Event Loop ==========

    private void startEventLoop() {
        Thread eventThread = new Thread(() -> {
            try {
                EventQueue queue = vm.eventQueue();
                while (running && vm != null) {
                    EventSet eventSet = queue.remove(); // blocks
                    boolean resume = true;

                    for (Event event : eventSet) {
                        if (event instanceof BreakpointEvent) {
                            BreakpointEvent bpe = (BreakpointEvent) event;

                            // Check conditional breakpoint
                            BreakpointRequest bpr = (BreakpointRequest) bpe.request();
                            String condition = bpr != null ? (String) bpr.getProperty("condition") : null;
                            if (condition != null && !condition.isEmpty()) {
                                // Evaluate condition
                                boolean condResult = evaluateCondition(bpe.thread(), condition);
                                if (!condResult) {
                                    // Condition false, resume
                                    continue;
                                }
                            }

                            log("Breakpoint hit: " + bpe.location());
                            sendStoppedEvent("breakpoint", bpe.thread().uniqueID());
                            resume = false;

                        } else if (event instanceof StepEvent) {
                            StepEvent se = (StepEvent) event;
                            // Delete the step request (one-shot)
                            vm.eventRequestManager().deleteEventRequest(se.request());
                            log("Step completed: " + se.location());
                            sendStoppedEvent("step", se.thread().uniqueID());
                            resume = false;

                        } else if (event instanceof ClassPrepareEvent) {
                            ClassPrepareEvent cpe = (ClassPrepareEvent) event;
                            ReferenceType refType = cpe.referenceType();
                            log("Class prepared: " + refType.name());
                            handleClassPrepared(refType);
                            // Resume after setting breakpoints
                            resume = true;

                        } else if (event instanceof VMStartEvent) {
                            // VMStartEvent represents the initial VM suspension (suspend=y).
                            // Do NOT resume — configurationDone will resume when client is ready.
                            log("VMStartEvent received, keeping VM suspended");
                            resume = false;

                        } else if (event instanceof ThreadStartEvent) {
                            ThreadStartEvent tse = (ThreadStartEvent) event;
                            sendThreadEvent("started", (int) tse.thread().uniqueID());

                        } else if (event instanceof ThreadDeathEvent) {
                            ThreadDeathEvent tde = (ThreadDeathEvent) event;
                            sendThreadEvent("exited", (int) tde.thread().uniqueID());

                        } else if (event instanceof VMDeathEvent) {
                            log("VM death event");
                            sendEvent("terminated", new HashMap<>());
                            running = false;
                            return;

                        } else if (event instanceof VMDisconnectEvent) {
                            log("VM disconnect event");
                            sendEvent("terminated", new HashMap<>());
                            running = false;
                            return;

                        } else if (event instanceof ExceptionEvent) {
                            ExceptionEvent ee = (ExceptionEvent) event;
                            log("Exception: " + ee.exception().referenceType().name() + " at " + ee.location());
                            Map<String, Object> body = new HashMap<>();
                            body.put("reason", "exception");
                            body.put("threadId", (int) ee.thread().uniqueID());
                            body.put("text", ee.exception().referenceType().name());
                            body.put("allThreadsStopped", true);
                            sendEvent("stopped", body);
                            resume = false;
                        }
                    }

                    if (resume) {
                        eventSet.resume();
                    }
                }
            } catch (VMDisconnectedException e) {
                log("VM disconnected in event loop");
                sendEvent("terminated", new HashMap<>());
            } catch (InterruptedException e) {
                log("Event loop interrupted");
            } catch (Exception e) {
                log("Event loop error: " + e.getMessage());
            }
        }, "jdi-event-loop");
        eventThread.setDaemon(true);
        eventThread.start();
    }

    private void handleClassPrepared(ReferenceType refType) {
        String className = refType.name();
        // Also check simple name (without package)
        String simpleName = className.contains(".") ? className.substring(className.lastIndexOf('.') + 1) : className;

        Map<String, Object> bpInfo = deferredBreakpoints.get(simpleName);
        if (bpInfo == null) bpInfo = deferredBreakpoints.get(className);
        if (bpInfo == null) return;

        String sourcePath = str(bpInfo, "sourcePath");
        List<Object> breakpointSpecs = list(bpInfo, "breakpoints");
        if (breakpointSpecs == null) return;

        log("Setting deferred breakpoints on " + className);
        for (Object bpObj : breakpointSpecs) {
            Map<String, Object> bpSpec = asMap(bpObj);
            int line = intVal(bpSpec, "line");
            String condition = str(bpSpec, "condition");
            Map<String, Object> bp = setBreakpointOnClass(refType, line, condition, sourcePath);

            // Send breakpoint verified event
            if (Boolean.TRUE.equals(bp.get("verified"))) {
                Map<String, Object> bpEvent = new HashMap<>();
                bpEvent.put("reason", "changed");
                Map<String, Object> bpBody = new HashMap<>();
                bpBody.put("verified", true);
                bpBody.put("line", bp.get("line"));
                if (sourcePath != null) {
                    bpBody.put("source", mapOf("path", sourcePath));
                }
                bpEvent.put("breakpoint", bpBody);
                sendEvent("breakpoint", bpEvent);
            }
        }
    }

    private boolean evaluateCondition(ThreadReference thread, String condition) {
        try {
            List<StackFrame> frames = thread.frames();
            if (frames.isEmpty()) return true;
            StackFrame sf = frames.get(0);

            // Simple variable comparison: "x == 5", "name.equals(\"foo\")"
            // For now, just evaluate as variable name and check truthiness
            try {
                LocalVariable lv = sf.visibleVariableByName(condition);
                if (lv != null) {
                    Value val = sf.getValue(lv);
                    return isTruthy(val);
                }
            } catch (AbsentInformationException e) { /* fall through */ }

            // Can't evaluate complex conditions without a full expression parser
            return true; // default: break
        } catch (Exception e) {
            return true; // default: break on error
        }
    }

    private boolean isTruthy(Value val) {
        if (val == null) return false;
        if (val instanceof BooleanValue) return ((BooleanValue) val).value();
        if (val instanceof IntegerValue) return ((IntegerValue) val).value() != 0;
        if (val instanceof LongValue) return ((LongValue) val).value() != 0;
        return true; // objects are truthy
    }

    // ========== Helpers ==========

    private AttachingConnector findAttachConnector() {
        for (Connector c : Bootstrap.virtualMachineManager().allConnectors()) {
            if (c instanceof AttachingConnector && c.name().equals("com.sun.jdi.SocketAttach")) {
                return (AttachingConnector) c;
            }
        }
        throw new RuntimeException("SocketAttach connector not found");
    }

    private ThreadReference findThread(int threadId) {
        if (vm == null) return null;
        try {
            for (ThreadReference tr : vm.allThreads()) {
                if (tr.uniqueID() == threadId) return tr;
            }
        } catch (VMDisconnectedException e) { /* VM gone */ }
        return null;
    }

    private int encodeFrameId(int threadId, int frameIndex) {
        return threadId * 100000 + frameIndex;
    }

    private String resolveSourcePath(Location loc) {
        try {
            String sourceName = loc.sourceName();
            String className = loc.declaringType().name().replace('.', '/');
            // Strip the class name to get the package path prefix
            int lastSlash = className.lastIndexOf('/');
            String baseName = sourceName.replace(".java", "");

            // Check if we have a known source path for this class
            String knownPath = sourcePathMap.get(baseName);
            if (knownPath != null) return knownPath;

            // Try with package prefix
            if (lastSlash >= 0) {
                return className.substring(0, lastSlash + 1) + sourceName;
            }
            return sourceName;
        } catch (AbsentInformationException e) {
            return loc.declaringType().name();
        }
    }

    private void clearFrameCache() {
        threadFrameCache.clear();
        varRefMap.clear();
        scopeRefMap.clear();
        nextVarRef.set(1);
    }

    private void cleanup() {
        if (vm != null) {
            try {
                vm.dispose();
            } catch (Exception e) { /* ignore */ }
            vm = null;
        }
        if (launchedProcess != null) {
            try {
                launchedProcess.destroyForcibly();
            } catch (Exception e) { /* ignore */ }
            launchedProcess = null;
        }
    }

    private String findJava() {
        String javaHome = System.getenv("JAVA_HOME");
        if (javaHome != null) {
            File javaExe = new File(javaHome, "bin/java");
            if (javaExe.canExecute()) return javaExe.getAbsolutePath();
        }
        return "java";
    }

    private String stepCommandName(int depth) {
        switch (depth) {
            case StepRequest.STEP_OVER: return "next";
            case StepRequest.STEP_INTO: return "stepIn";
            case StepRequest.STEP_OUT: return "stepOut";
            default: return "step";
        }
    }

    // ========== DAP Message Construction ==========

    private void sendResponse(int reqSeq, String command, boolean success, Map<String, Object> body) {
        Map<String, Object> resp = new HashMap<>();
        resp.put("seq", seq.getAndIncrement());
        resp.put("type", "response");
        resp.put("request_seq", reqSeq);
        resp.put("success", success);
        resp.put("command", command);
        resp.put("body", body);
        sendDapMessage(resp);
    }

    private void sendErrorResponse(int reqSeq, String command, String message) {
        Map<String, Object> body = new HashMap<>();
        Map<String, Object> error = new HashMap<>();
        error.put("id", 1);
        error.put("format", message);
        body.put("error", error);

        Map<String, Object> resp = new HashMap<>();
        resp.put("seq", seq.getAndIncrement());
        resp.put("type", "response");
        resp.put("request_seq", reqSeq);
        resp.put("success", false);
        resp.put("command", command);
        resp.put("message", message);
        resp.put("body", body);
        sendDapMessage(resp);
    }

    private void sendEvent(String event, Map<String, Object> body) {
        Map<String, Object> evt = new HashMap<>();
        evt.put("seq", seq.getAndIncrement());
        evt.put("type", "event");
        evt.put("event", event);
        evt.put("body", body);
        sendDapMessage(evt);
    }

    private void sendStoppedEvent(String reason, long threadId) {
        Map<String, Object> body = new HashMap<>();
        body.put("reason", reason);
        body.put("threadId", (int) threadId);
        body.put("allThreadsStopped", true);
        sendEvent("stopped", body);
    }

    private void sendThreadEvent(String reason, int threadId) {
        Map<String, Object> body = new HashMap<>();
        body.put("reason", reason);
        body.put("threadId", threadId);
        sendEvent("thread", body);
    }

    private void sendOutputEvent(String category, String output) {
        Map<String, Object> body = new HashMap<>();
        body.put("category", category);
        body.put("output", output);
        sendEvent("output", body);
    }

    // ========== Minimal JSON Parser/Writer (no deps) ==========

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJson(String json) {
        return (Map<String, Object>) new JsonParser(json).parseValue();
    }

    private String toJson(Object obj) {
        StringBuilder sb = new StringBuilder();
        writeJson(sb, obj);
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private void writeJson(StringBuilder sb, Object obj) {
        if (obj == null) {
            sb.append("null");
        } else if (obj instanceof Boolean) {
            sb.append(obj);
        } else if (obj instanceof Number) {
            // Avoid scientific notation for integers
            if (obj instanceof Double || obj instanceof Float) {
                double d = ((Number) obj).doubleValue();
                if (d == Math.floor(d) && !Double.isInfinite(d)) {
                    sb.append((long) d);
                } else {
                    sb.append(d);
                }
            } else {
                sb.append(obj);
            }
        } else if (obj instanceof String) {
            sb.append('"');
            String s = (String) obj;
            for (int i = 0; i < s.length(); i++) {
                char c = s.charAt(i);
                switch (c) {
                    case '"': sb.append("\\\""); break;
                    case '\\': sb.append("\\\\"); break;
                    case '\n': sb.append("\\n"); break;
                    case '\r': sb.append("\\r"); break;
                    case '\t': sb.append("\\t"); break;
                    default:
                        if (c < 0x20) {
                            sb.append(String.format("\\u%04x", (int) c));
                        } else {
                            sb.append(c);
                        }
                }
            }
            sb.append('"');
        } else if (obj instanceof Map) {
            sb.append('{');
            boolean first = true;
            for (Map.Entry<?, ?> entry : ((Map<?, ?>) obj).entrySet()) {
                if (!first) sb.append(',');
                first = false;
                writeJson(sb, String.valueOf(entry.getKey()));
                sb.append(':');
                writeJson(sb, entry.getValue());
            }
            sb.append('}');
        } else if (obj instanceof List) {
            sb.append('[');
            boolean first = true;
            for (Object item : (List<?>) obj) {
                if (!first) sb.append(',');
                first = false;
                writeJson(sb, item);
            }
            sb.append(']');
        } else {
            sb.append('"');
            sb.append(obj.toString().replace("\"", "\\\""));
            sb.append('"');
        }
    }

    // Minimal recursive-descent JSON parser
    private static class JsonParser {
        private final String input;
        private int pos;

        JsonParser(String input) {
            this.input = input;
            this.pos = 0;
        }

        Object parseValue() {
            skipWhitespace();
            if (pos >= input.length()) return null;
            char c = input.charAt(pos);
            if (c == '{') return parseObject();
            if (c == '[') return parseArray();
            if (c == '"') return parseString();
            if (c == 't' || c == 'f') return parseBoolean();
            if (c == 'n') return parseNull();
            return parseNumber();
        }

        Map<String, Object> parseObject() {
            Map<String, Object> map = new LinkedHashMap<>();
            pos++; // skip '{'
            skipWhitespace();
            if (pos < input.length() && input.charAt(pos) == '}') { pos++; return map; }
            while (pos < input.length()) {
                skipWhitespace();
                String key = parseString();
                skipWhitespace();
                pos++; // skip ':'
                Object value = parseValue();
                map.put(key, value);
                skipWhitespace();
                if (pos < input.length() && input.charAt(pos) == ',') { pos++; continue; }
                break;
            }
            if (pos < input.length() && input.charAt(pos) == '}') pos++;
            return map;
        }

        List<Object> parseArray() {
            List<Object> list = new ArrayList<>();
            pos++; // skip '['
            skipWhitespace();
            if (pos < input.length() && input.charAt(pos) == ']') { pos++; return list; }
            while (pos < input.length()) {
                list.add(parseValue());
                skipWhitespace();
                if (pos < input.length() && input.charAt(pos) == ',') { pos++; continue; }
                break;
            }
            if (pos < input.length() && input.charAt(pos) == ']') pos++;
            return list;
        }

        String parseString() {
            pos++; // skip opening '"'
            StringBuilder sb = new StringBuilder();
            while (pos < input.length()) {
                char c = input.charAt(pos);
                if (c == '"') { pos++; return sb.toString(); }
                if (c == '\\') {
                    pos++;
                    if (pos >= input.length()) break;
                    char esc = input.charAt(pos);
                    switch (esc) {
                        case '"': sb.append('"'); break;
                        case '\\': sb.append('\\'); break;
                        case '/': sb.append('/'); break;
                        case 'n': sb.append('\n'); break;
                        case 'r': sb.append('\r'); break;
                        case 't': sb.append('\t'); break;
                        case 'b': sb.append('\b'); break;
                        case 'f': sb.append('\f'); break;
                        case 'u':
                            String hex = input.substring(pos + 1, pos + 5);
                            sb.append((char) Integer.parseInt(hex, 16));
                            pos += 4;
                            break;
                        default: sb.append(esc);
                    }
                } else {
                    sb.append(c);
                }
                pos++;
            }
            return sb.toString();
        }

        Object parseNumber() {
            int start = pos;
            if (pos < input.length() && input.charAt(pos) == '-') pos++;
            while (pos < input.length() && Character.isDigit(input.charAt(pos))) pos++;
            boolean isFloat = false;
            if (pos < input.length() && input.charAt(pos) == '.') {
                isFloat = true;
                pos++;
                while (pos < input.length() && Character.isDigit(input.charAt(pos))) pos++;
            }
            if (pos < input.length() && (input.charAt(pos) == 'e' || input.charAt(pos) == 'E')) {
                isFloat = true;
                pos++;
                if (pos < input.length() && (input.charAt(pos) == '+' || input.charAt(pos) == '-')) pos++;
                while (pos < input.length() && Character.isDigit(input.charAt(pos))) pos++;
            }
            String numStr = input.substring(start, pos);
            if (isFloat) return Double.parseDouble(numStr);
            long l = Long.parseLong(numStr);
            if (l >= Integer.MIN_VALUE && l <= Integer.MAX_VALUE) return (int) l;
            return l;
        }

        Boolean parseBoolean() {
            if (input.startsWith("true", pos)) { pos += 4; return true; }
            if (input.startsWith("false", pos)) { pos += 5; return false; }
            throw new RuntimeException("Invalid boolean at " + pos);
        }

        Object parseNull() {
            if (input.startsWith("null", pos)) { pos += 4; return null; }
            throw new RuntimeException("Invalid null at " + pos);
        }

        void skipWhitespace() {
            while (pos < input.length() && Character.isWhitespace(input.charAt(pos))) pos++;
        }
    }

    // ========== Map/JSON Helpers ==========

    private static String str(Map<String, Object> m, String key) {
        if (m == null) return null;
        Object v = m.get(key);
        return v != null ? String.valueOf(v) : null;
    }

    private static String strOr(Map<String, Object> m, String key, String def) {
        String v = str(m, key);
        return v != null ? v : def;
    }

    private static int intVal(Map<String, Object> m, String key) {
        if (m == null) return 0;
        Object v = m.get(key);
        if (v instanceof Number) return ((Number) v).intValue();
        if (v instanceof String) try { return Integer.parseInt((String) v); } catch (NumberFormatException e) { /* */ }
        return 0;
    }

    private static Integer intValOrNull(Map<String, Object> m, String key) {
        if (m == null) return null;
        Object v = m.get(key);
        if (v instanceof Number) return ((Number) v).intValue();
        if (v instanceof String) try { return Integer.parseInt((String) v); } catch (NumberFormatException e) { /* */ }
        return null;
    }

    private static boolean boolVal(Map<String, Object> m, String key, boolean def) {
        if (m == null) return def;
        Object v = m.get(key);
        if (v instanceof Boolean) return (Boolean) v;
        if (v instanceof String) return Boolean.parseBoolean((String) v);
        return def;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Map<String, Object> m, String key) {
        if (m == null) return null;
        Object v = m.get(key);
        return v instanceof Map ? (Map<String, Object>) v : null;
    }

    @SuppressWarnings("unchecked")
    private static List<Object> list(Map<String, Object> m, String key) {
        if (m == null) return null;
        Object v = m.get(key);
        return v instanceof List ? (List<Object>) v : null;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object obj) {
        return obj instanceof Map ? (Map<String, Object>) obj : new HashMap<>();
    }

    private static Map<String, Object> mapOf(String key, Object value) {
        Map<String, Object> m = new HashMap<>();
        m.put(key, value);
        return m;
    }

    private static void log(String msg) {
        System.err.println("[JdiDapServer] " + msg);
    }

    private static void logVerbose(String msg) {
        if (debug) System.err.println("[JdiDapServer] " + msg);
    }
}
