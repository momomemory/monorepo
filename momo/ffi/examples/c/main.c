#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "../../include/momo.h"

static void fail_with_error(const char *context, char *error) {
    fprintf(stderr, "%s: %s\n", context, error != NULL ? error : "unknown error");
    momo_string_free(error);
    exit(1);
}

static char *call_json_api(
    const char *context,
    char *(*func)(MomoEngine *, const char *, char **),
    MomoEngine *engine,
    const char *json
) {
    char *error = NULL;
    char *response = func(engine, json, &error);
    if (response == NULL) {
        fail_with_error(context, error);
    }

    if (error != NULL) {
        momo_string_free(error);
    }

    return response;
}

int main(void) {
    const char *db_path = "momo-ffi-example.db";
    unlink(db_path);

    setenv("DATABASE_URL", "file:momo-ffi-example.db", 1);
    setenv("OCR_MODEL", "openai/vision", 1);
    setenv("TRANSCRIPTION_MODEL", "openai/whisper-1", 1);
    setenv("ENABLE_INFERENCES", "false", 1);

    char *error = NULL;
    MomoEngine *engine = momo_engine_new(NULL, false, &error);
    if (engine == NULL) {
        fail_with_error("momo_engine_new", error);
    }

    const char *create_request =
        "{"
        "\"content\":\"The user prefers dark mode and keyboard shortcuts.\","
        "\"container_tag\":\"ffi-example\""
        "}";
    char *created = call_json_api(
        "momo_engine_create_memory_json",
        momo_engine_create_memory_json,
        engine,
        create_request
    );
    printf("Created memory:\n%s\n\n", created);
    momo_string_free(created);

    const char *search_request =
        "{"
        "\"q\":\"dark mode\","
        "\"container_tag\":\"ffi-example\","
        "\"limit\":5"
        "}";
    char *search_results = call_json_api(
        "momo_engine_search_memories_json",
        momo_engine_search_memories_json,
        engine,
        search_request
    );
    printf("Search results:\n%s\n", search_results);
    momo_string_free(search_results);

    momo_engine_free(engine);
    return 0;
}
