# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/src/item.rs
@source-hash: ad2d5f4621426420
@generated: 2026-02-09T18:12:14Z

## Primary Purpose

This module defines the complete set of Rust syntax tree nodes for items (top-level declarations) in the Syn parsing library. It provides AST representations for all Rust items including functions, structs, enums, traits, impls, modules, and more, along with their parsing and printing implementations.

## Core Item Enum

**Item (L20-99)**: The main enum representing any top-level item in Rust code. Contains 16 variants:
- `Const(ItemConst)`: Constants like `const MAX: u16 = 65535`
- `Enum(ItemEnum)`: Enum definitions 
- `ExternCrate(ItemExternCrate)`: External crate imports
- `Fn(ItemFn)`: Functions
- `ForeignMod(ItemForeignMod)`: `extern` blocks
- `Impl(ItemImpl)`: Implementation blocks
- `Macro(ItemMacro)`: Macro invocations
- `Mod(ItemMod)`: Modules
- `Static(ItemStatic)`: Static items
- `Struct(ItemStruct)`: Struct definitions
- `Trait(ItemTrait)`: Trait definitions
- `TraitAlias(ItemTraitAlias)`: Trait aliases
- `Type(ItemType)`: Type aliases
- `Union(ItemUnion)`: Union definitions
- `Use(ItemUse)`: Use declarations
- `Verbatim(TokenStream)`: Unparsed tokens

## Individual Item Structs

### Basic Items
- **ItemConst (L104-116)**: Constant declarations with attributes, visibility, type, and value
- **ItemStatic (L217-229)**: Static items with mutability support
- **ItemType (L282-292)**: Type aliases with generics support

### Complex Items
- **ItemFn (L149-155)**: Function items with signature and block body
- **ItemStruct (L234-243)**: Struct definitions with various field configurations
- **ItemEnum (L121-130)**: Enum definitions with variants
- **ItemUnion (L297-305)**: Union definitions with named fields
- **ItemTrait (L248-262)**: Trait definitions with supertraits and associated items
- **ItemImpl (L173-186)**: Implementation blocks for types and traits

### Module System
- **ItemMod (L203-212)**: Module declarations, can be inline or external
- **ItemUse (L310-318)**: Import declarations with complex tree structure
- **ItemExternCrate (L135-144)**: External crate imports with optional renaming
- **ItemForeignMod (L160-167)**: Foreign function interface blocks

## Use Tree System

**UseTree (L433-449)**: Enum for import path components:
- `Path(UsePath)`: Path segments
- `Name(UseName)`: Simple identifiers
- `Rename(UseRename)`: Renamed imports
- `Glob(UseGlob)`: Glob imports (`*`)
- `Group(UseGroup)`: Grouped imports (`{...}`)

Supporting structs: `UsePath (L454-459)`, `UseName (L464-467)`, `UseRename (L472-477)`, `UseGlob (L482-485)`, `UseGroup (L490-494)`

## Nested Item Enums

### Foreign Items (L506-540)
**ForeignItem**: Items inside `extern` blocks
- `Fn(ForeignItemFn)`: Foreign functions
- `Static(ForeignItemStatic)`: Foreign statics
- `Type(ForeignItemType)`: Foreign types  
- `Macro(ForeignItemMacro)`: Macros in foreign blocks
- `Verbatim(TokenStream)`: Unparsed content

### Trait Items (L601-635)
**TraitItem**: Items inside trait definitions
- `Const(TraitItemConst)`: Associated constants
- `Fn(TraitItemFn)`: Associated functions/methods
- `Type(TraitItemType)`: Associated types
- `Macro(TraitItemMacro)`: Macros in traits
- `Verbatim(TokenStream)`: Unparsed content

### Impl Items (L698-732)
**ImplItem**: Items inside implementation blocks
- `Const(ImplItemConst)`: Associated constants
- `Fn(ImplItemFn)`: Associated functions/methods
- `Type(ImplItemType)`: Associated types
- `Macro(ImplItemMacro)`: Macros in impls
- `Verbatim(TokenStream)`: Unparsed content

## Function Signatures

**Signature (L794-807)**: Complete function signature representation including:
- Constness, asyncness, unsafety modifiers
- ABI specification
- Generics and where clauses
- Parameter list and variadic arguments
- Return type

**FnArg (L823-830)**: Function arguments, either `Receiver` (self) or `Typed` (regular parameters)
**Receiver (L841-849)**: Method self receivers with reference/mutability handling
**Variadic (L870-876)**: Variadic argument representation for foreign functions

## Utilities

**StaticMutability (L882-886)**: Enum for static item mutability
**ImplRestriction (L892-903)**: Placeholder for future RFC 3323 restrictions

## Key Implementation Details

- **replace_attrs method (L322-342)**: Utility for swapping attributes on any item type
- **Conversion traits (L344-422)**: Bidirectional conversion between `Item` variants and `DeriveInput`
- **Signature receiver method (L811-818)**: Extract method self receiver from signature

## Parsing Module (L906-2929)

Comprehensive parsing implementation for all item types with sophisticated lookahead and error handling. Key functions:
- `parse_rest_of_item (L946-1121)`: Main item parsing dispatch
- `FlexibleItemType (L1123-1233)`: Flexible type item parsing for various contexts
- Complex parsing for traits, impls, and foreign items with proper validation

## Printing Module (L2932-3490)

Complete `ToTokens` implementations for all item types, ensuring proper token stream generation for code formatting and macro expansion.

## Architecture Notes

- Uses `ast_struct!` and `ast_enum_of_structs!` macros for consistent AST node generation
- Extensive use of `Option` types for optional syntax elements
- Proper token preservation for accurate source code reconstruction
- Feature-gated parsing and printing implementations
- Comprehensive attribute support throughout all item types