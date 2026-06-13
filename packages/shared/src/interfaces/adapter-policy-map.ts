import type { AdapterPolicy } from './adapter-policy.js';
import { DefaultAdapterPolicy } from './adapter-policy.js';
import { PythonAdapterPolicy } from './adapter-policy-python.js';
import { JsDebugAdapterPolicy } from './adapter-policy-js.js';
import { RubyAdapterPolicy } from './adapter-policy-ruby.js';
import { RustAdapterPolicy } from './adapter-policy-rust.js';
import { GoAdapterPolicy } from './adapter-policy-go.js';
import { JavaAdapterPolicy } from './adapter-policy-java.js';
import { DotnetAdapterPolicy } from './adapter-policy-dotnet.js';
import { MockAdapterPolicy } from './adapter-policy-mock.js';
import { DebugLanguage } from '../models/index.js';

/**
 * Single source of truth for mapping a debug language to its adapter policy.
 * Used by SessionStore, SessionManager, and the DAP proxy worker so the
 * mapping cannot drift between processes.
 */
export function getPolicyForLanguage(language: string | DebugLanguage): AdapterPolicy {
  switch (language) {
    case DebugLanguage.PYTHON:
      return PythonAdapterPolicy;
    case DebugLanguage.JAVASCRIPT:
      return JsDebugAdapterPolicy;
    case DebugLanguage.RUBY:
      return RubyAdapterPolicy;
    case DebugLanguage.RUST:
      return RustAdapterPolicy;
    case DebugLanguage.GO:
      return GoAdapterPolicy;
    case DebugLanguage.JAVA:
      return JavaAdapterPolicy;
    case DebugLanguage.DOTNET:
      return DotnetAdapterPolicy;
    case DebugLanguage.MOCK:
      return MockAdapterPolicy;
    default:
      return DefaultAdapterPolicy;
  }
}
