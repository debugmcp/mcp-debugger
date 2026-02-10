# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/dom/__init__.py
@source-hash: b415a6f3d3663c3a
@generated: 2026-02-09T18:06:08Z

**Purpose:** Core constants, exceptions, and registry infrastructure for Python's W3C Document Object Model implementation. Part of xml.dom package providing foundation classes for DOM tree manipulation.

**Key Components:**

- **Node (L18-41):** Base class defining W3C DOM node type constants (ELEMENT_NODE=1, TEXT_NODE=3, etc.). Uses `__slots__ = ()` for memory efficiency. Serves as canonical reference for nodeType values across all DOM implementations.

- **DOM Exception Constants (L44-59):** Complete set of W3C DOM exception codes (INDEX_SIZE_ERR=1 through VALIDATION_ERR=16) used by exception classes.

- **DOMException (L62-74):** Abstract base exception class with code property accessor. Prevents direct instantiation via runtime check in `__init__`.

- **Specific Exception Classes (L76-122):** Concrete DOM exceptions inheriting from DOMException, each with corresponding error code:
  - IndexSizeErr, DomstringSizeErr, HierarchyRequestErr, WrongDocumentErr
  - InvalidCharacterErr, NoDataAllowedErr, NoModificationAllowedErr
  - NotFoundErr, NotSupportedErr, InuseAttributeErr, InvalidStateErr
  - SyntaxErr, InvalidModificationErr, NamespaceErr, InvalidAccessErr, ValidationErr

- **UserDataHandler (L124-132):** Constants class for DOM Level 3 user data operations (NODE_CLONED=1, NODE_IMPORTED=2, NODE_DELETED=3, NODE_RENAMED=4).

- **Namespace Constants (L134-138):** Standard XML namespace URIs (XML_NAMESPACE, XMLNS_NAMESPACE, XHTML_NAMESPACE) plus EMPTY_NAMESPACE/EMPTY_PREFIX markers.

- **Registry Import (L140):** Imports getDOMImplementation and registerDOMImplementation from domreg module for DOM implementation discovery.

**Dependencies:** 
- Internal: domreg module for implementation registry
- External: Standard Python Exception class

**Architecture Notes:**
- Follows W3C DOM specification precisely for constants and exception hierarchy
- Uses class-level constants pattern for type-safe enumeration
- Exception hierarchy enables specific error handling while maintaining code compatibility
- Registry pattern allows pluggable DOM implementations