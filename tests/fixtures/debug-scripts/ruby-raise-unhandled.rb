# Unhandled-raise fixture (issue #258): rdbg -c propagates the debuggee's
# non-zero exit status. The session must end 'stopped' with exitCode 1 —
# a debuggee crash is a normal debugging outcome, not a session error.
puts 'about to raise'
raise 'boom'
