# C Example

This example shows the smallest useful C integration against `momo-ffi`.

## Build

From `momo/`:

```bash
cargo build -p momo-ffi
```

From this directory:

```bash
cc main.c -I../../include -L../../../target/debug -lmomo_ffi -o momo_ffi_example
```

## Run

```bash
DYLD_FALLBACK_LIBRARY_PATH=../../../target/debug ./momo_ffi_example
```

What it does:

1. Uses environment variables for engine configuration
2. Creates a local embedded engine
3. Writes one memory with `momo_engine_create_memory_json`
4. Reads it back with `momo_engine_search_memories_json`

The example writes its data to `momo-ffi-example.db` in the current directory.
