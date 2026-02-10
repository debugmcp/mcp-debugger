# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/mime/base.py
@source-hash: 9a7b36653b565752
@generated: 2026-02-09T18:06:06Z

## Purpose
Foundational base class for MIME (Multipurpose Internet Mail Extensions) message specializations in Python's email package. Provides core MIME message structure with mandatory headers.

## Core Components

### MIMEBase Class (L14-29)
- **Inheritance**: Extends `email.message.Message` 
- **Purpose**: Abstract base for all MIME message types (text, image, audio, etc.)
- **Key Responsibilities**:
  - Automatic Content-Type header generation from maintype/subtype parameters
  - MIME-Version header injection (always "1.0")
  - Policy-aware message construction

### Constructor `__init__` (L17-29)
- **Parameters**: 
  - `_maintype`: Primary MIME type (e.g., "text", "image")
  - `_subtype`: MIME subtype (e.g., "plain", "html", "jpeg")
  - `policy`: Email policy object (defaults to compat32)
  - `**_params`: Additional Content-Type parameters (charset, boundary, etc.)
- **Behavior**:
  - Constructs Content-Type as "{maintype}/{subtype}" (L27)
  - Adds Content-Type header with parameters (L28)
  - Sets MIME-Version to "1.0" (L29)

## Dependencies
- `email.policy`: Policy framework for email handling (L9)
- `email.message`: Core Message class for inheritance (L11)

## Architectural Pattern
Factory base pattern - this class is designed to be subclassed by specific MIME types (MIMEText, MIMEImage, etc.) rather than used directly. The constructor signature enforces MIME structure requirements while allowing flexible parameter passing.

## Usage Context
Part of Python's standard library email package, typically instantiated through specialized subclasses in email composition workflows. The policy parameter enables different email standards compliance modes.