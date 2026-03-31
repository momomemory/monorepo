# Momo FFI

`momo-ffi` exposes a small C ABI over the embedded `MomoEngine` runtime.

## Build

From `momo/`:

```bash
cargo build -p momo-ffi
```

This produces:

- `target/debug/libmomo_ffi.dylib`
- `target/debug/libmomo_ffi.a`
- C header: `ffi/include/momo.h`

## Minimal C Example

A minimal end-to-end C example lives at `ffi/examples/c`.

Build the library first:

```bash
cargo build -p momo-ffi
```

Then build the example:

```bash
cd ffi/examples/c
cc main.c -I../../include -L../../../target/debug -lmomo_ffi -o momo_ffi_example
```

Run it with the built dylib on the loader path:

```bash
DYLD_FALLBACK_LIBRARY_PATH=../../../target/debug ./momo_ffi_example
```

The example:

- creates an embedded engine
- inserts a memory via JSON
- searches memories via JSON
- frees all returned strings and engine handles correctly
