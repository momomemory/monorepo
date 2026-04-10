use std::ffi::{c_char, CStr, CString};
use std::ptr;

use momo::config::Config;
use momo::engine::MomoEngine;
use momo::migration::DimensionMismatchPolicy;

type MomoResult<T> = std::result::Result<T, String>;

fn read_c_string(ptr: *const c_char, field: &str) -> MomoResult<Option<String>> {
    if ptr.is_null() {
        return Ok(None);
    }

    let value = unsafe { CStr::from_ptr(ptr) }
        .to_str()
        .map_err(|error| format!("Invalid UTF-8 for {field}: {error}"))?
        .to_string();
    Ok(Some(value))
}

fn into_c_string(value: String) -> *mut c_char {
    CString::new(value).expect("CString::new failed").into_raw()
}

fn write_error(error_out: *mut *mut c_char, message: String) {
    if error_out.is_null() {
        return;
    }

    unsafe {
        *error_out = into_c_string(message);
    }
}

fn clear_error(error_out: *mut *mut c_char) {
    if error_out.is_null() {
        return;
    }

    unsafe {
        *error_out = ptr::null_mut();
    }
}

fn parse_config(config_json: Option<String>) -> MomoResult<Config> {
    match config_json {
        Some(config_json) => serde_json::from_str(&config_json)
            .map_err(|error| format!("Invalid config JSON: {error}")),
        None => Ok(Config::from_env()),
    }
}

#[no_mangle]
/// # Safety
///
/// `ptr` must have been returned by this library from `CString::into_raw` and
/// must not be freed more than once.
pub unsafe extern "C" fn momo_string_free(ptr: *mut c_char) {
    if ptr.is_null() {
        return;
    }

    unsafe {
        drop(CString::from_raw(ptr));
    }
}

#[no_mangle]
pub extern "C" fn momo_engine_new(
    config_json: *const c_char,
    rebuild_embeddings: bool,
    error_out: *mut *mut c_char,
) -> *mut MomoEngine {
    clear_error(error_out);

    let result = (|| {
        let config = parse_config(read_c_string(config_json, "config_json")?)?;
        let migration_policy = if rebuild_embeddings {
            DimensionMismatchPolicy::Rebuild
        } else {
            DimensionMismatchPolicy::Reject
        };
        MomoEngine::from_config(config, migration_policy)
            .map(Box::new)
            .map(Box::into_raw)
            .map_err(|error| error.to_string())
    })();

    match result {
        Ok(engine) => engine,
        Err(error) => {
            write_error(error_out, error);
            ptr::null_mut()
        }
    }
}

#[no_mangle]
/// # Safety
///
/// `engine` must be a valid pointer returned by `momo_engine_new` and must not
/// be freed more than once.
pub unsafe extern "C" fn momo_engine_free(engine: *mut MomoEngine) {
    if engine.is_null() {
        return;
    }

    unsafe {
        drop(Box::from_raw(engine));
    }
}

#[no_mangle]
/// # Safety
///
/// `engine` must be a valid, uniquely borrowed pointer returned by
/// `momo_engine_new` for the duration of this call.
pub unsafe extern "C" fn momo_engine_start_workers(
    engine: *mut MomoEngine,
    error_out: *mut *mut c_char,
) -> bool {
    clear_error(error_out);

    if engine.is_null() {
        write_error(error_out, "Engine pointer was null".to_string());
        return false;
    }

    let result = unsafe { &mut *engine }.start_workers(Default::default());
    if let Err(error) = result {
        write_error(error_out, error.to_string());
        return false;
    }

    true
}

#[no_mangle]
/// # Safety
///
/// `engine` must be a valid, uniquely borrowed pointer returned by
/// `momo_engine_new` for the duration of this call.
pub unsafe extern "C" fn momo_engine_stop_workers(engine: *mut MomoEngine) {
    if engine.is_null() {
        return;
    }

    unsafe { &mut *engine }.stop_workers();
}

#[no_mangle]
/// # Safety
///
/// `engine` must be a valid pointer returned by `momo_engine_new`. If
/// `request_json` is non-null it must point to a valid NUL-terminated C string.
pub unsafe extern "C" fn momo_engine_create_memory_json(
    engine: *mut MomoEngine,
    request_json: *const c_char,
    error_out: *mut *mut c_char,
) -> *mut c_char {
    clear_error(error_out);

    if engine.is_null() {
        write_error(error_out, "Engine pointer was null".to_string());
        return ptr::null_mut();
    }

    let result = (|| {
        let request_json = read_c_string(request_json, "request_json")?
            .ok_or_else(|| "request_json was null".to_string())?;
        unsafe { &*engine }
            .create_memory_json(&request_json)
            .map(into_c_string)
            .map_err(|error| error.to_string())
    })();

    match result {
        Ok(response) => response,
        Err(error) => {
            write_error(error_out, error);
            ptr::null_mut()
        }
    }
}

#[no_mangle]
/// # Safety
///
/// `engine` must be a valid pointer returned by `momo_engine_new`. If
/// `request_json` is non-null it must point to a valid NUL-terminated C string.
pub unsafe extern "C" fn momo_engine_search_memories_json(
    engine: *mut MomoEngine,
    request_json: *const c_char,
    error_out: *mut *mut c_char,
) -> *mut c_char {
    clear_error(error_out);

    if engine.is_null() {
        write_error(error_out, "Engine pointer was null".to_string());
        return ptr::null_mut();
    }

    let result = (|| {
        let request_json = read_c_string(request_json, "request_json")?
            .ok_or_else(|| "request_json was null".to_string())?;
        unsafe { &*engine }
            .search_memories_json(&request_json)
            .map(into_c_string)
            .map_err(|error| error.to_string())
    })();

    match result {
        Ok(response) => response,
        Err(error) => {
            write_error(error_out, error);
            ptr::null_mut()
        }
    }
}

#[no_mangle]
/// # Safety
///
/// `engine` must be a valid pointer returned by `momo_engine_new`. If
/// `request_json` is non-null it must point to a valid NUL-terminated C string.
pub unsafe extern "C" fn momo_engine_search_documents_json(
    engine: *mut MomoEngine,
    request_json: *const c_char,
    error_out: *mut *mut c_char,
) -> *mut c_char {
    clear_error(error_out);

    if engine.is_null() {
        write_error(error_out, "Engine pointer was null".to_string());
        return ptr::null_mut();
    }

    let result = (|| {
        let request_json = read_c_string(request_json, "request_json")?
            .ok_or_else(|| "request_json was null".to_string())?;
        unsafe { &*engine }
            .search_documents_json(&request_json)
            .map(into_c_string)
            .map_err(|error| error.to_string())
    })();

    match result {
        Ok(response) => response,
        Err(error) => {
            write_error(error_out, error);
            ptr::null_mut()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn null_string_is_treated_as_missing() {
        let parsed = read_c_string(ptr::null(), "test").expect("null should be accepted");
        assert!(parsed.is_none());
    }
}
