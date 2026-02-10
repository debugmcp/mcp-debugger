# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/abc.py
@source-hash: 5f9cb36ca1bce9d5
@generated: 2026-02-09T18:11:12Z

## Purpose
Core Python import system abstract base classes defining the interface contracts for module finders and loaders. Part of Python's importlib machinery that enables custom import behavior through well-defined protocols.

## Key Classes and Hierarchy

### **MetaPathFinder** (L52-58)
ABC for sys.meta_path finders that locate modules at the top level of import resolution.
- `invalidate_caches()` (L59-62): Optional cache clearing method
- Registered with: BuiltinImporter, FrozenImporter, PathFinder, WindowsRegistryFinder (L64-65)

### **PathEntryFinder** (L68-75) 
ABC for path entry finders used by PathFinder to search individual path entries.
- `invalidate_caches()` (L72-75): Optional cache clearing method  
- Registered with: FileFinder (L77)

### **Loader Hierarchy**
Base `Loader` imported from `._abc` (L14), with specialized subclasses:

#### **ResourceLoader** (L80-93)
Extends Loader for data access from storage backends.
- `get_data(path)` (L89-93): Abstract method returning bytes for given path

#### **InspectLoader** (L96-144)  
Extends Loader for module introspection capabilities.
- `is_package(fullname)` (L105-111): Optional package detection
- `get_code(fullname)` (L113-124): Returns code object, delegates to get_source + source_to_code
- `get_source(fullname)` (L126-133): Abstract method returning source code string
- `source_to_code(data, path)` (L135-141): Static method compiling data to code object
- Inherits exec_module/load_module from _bootstrap_external (L143-144)
- Registered with: BuiltinImporter, FrozenImporter, NamespaceLoader (L146)

#### **ExecutionLoader** (L149-181)
Extends InspectLoader for script execution support.
- `get_filename(fullname)` (L158-165): Abstract method returning __file__ value
- Overrides `get_code(fullname)` (L167-181): Enhanced version using filename for compilation path
- Registered with: ExtensionFileLoader (L183)

#### **FileLoader** (L186-189)
Multiple inheritance: _bootstrap_external.FileLoader + ResourceLoader + ExecutionLoader
- Registered with: SourceFileLoader, SourcelessFileLoader (L191-192)

#### **SourceLoader** (L195-238)
Extends _bootstrap_external.SourceLoader + ResourceLoader + ExecutionLoader for source code loading.
- `path_mtime(path)` (L212-216): Returns modification time, delegates to path_stats if not overridden
- `path_stats(path)` (L218-227): Returns metadata dict with mtime/size, delegates to path_mtime if not overridden  
- `set_data(path, data)` (L229-237): Optional method for writing bytes to path
- Registered with: SourceFileLoader (L239)

## Key Functions

### **__getattr__(name)** (L28-38)
Dynamic attribute access for backward compatibility with _resources_abc, issues deprecation warnings for items scheduled for removal in Python 3.14.

### **_register(abstract_cls, *classes)** (L41-49)
Registers concrete classes with abstract base classes, handling both regular and frozen importlib variants.

## Dependencies
- `._bootstrap_external`: Core bootstrap functionality
- `.machinery`: Concrete importer implementations  
- `._abc.Loader`: Base loader class
- `.resources.abc`: Resource-related ABCs (deprecated access via __getattr__)
- `_frozen_importlib`/_`frozen_importlib_external`: Frozen C implementations (optional)

## Architecture Notes
- Uses ABC pattern with abstract methods enforced via @abc.abstractmethod
- Implements PEP 302 import protocols through optional/required method interfaces
- Dual implementation strategy: Python bootstrap + optional frozen C extensions
- Backward compatibility maintained through dynamic attribute access and registration of frozen variants