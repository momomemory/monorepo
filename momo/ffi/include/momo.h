#ifndef MOMO_H
#define MOMO_H

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct MomoEngine MomoEngine;

void momo_string_free(char *ptr);

MomoEngine *momo_engine_new(const char *config_json, bool rebuild_embeddings, char **error_out);
void momo_engine_free(MomoEngine *engine);

bool momo_engine_start_workers(MomoEngine *engine, char **error_out);
void momo_engine_stop_workers(MomoEngine *engine);

char *momo_engine_create_memory_json(MomoEngine *engine, const char *request_json, char **error_out);
char *momo_engine_search_memories_json(MomoEngine *engine, const char *request_json, char **error_out);
char *momo_engine_search_documents_json(MomoEngine *engine, const char *request_json, char **error_out);

#ifdef __cplusplus
}
#endif

#endif
