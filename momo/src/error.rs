use thiserror::Error;

#[derive(Error, Debug)]
pub enum MomoError {
    #[error("Database error: {0}")]
    Database(#[from] libsql::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Embedding error: {0}")]
    Embedding(String),

    #[error("Processing error: {0}")]
    Processing(String),

    #[error("HTTP request error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("URL parse error: {0}")]
    UrlParse(#[from] url::ParseError),

    #[error("API rate limit exceeded, retry after {retry_after:?} seconds")]
    #[allow(dead_code)] // Used in EmbeddingApiClient; matched in response.rs
    ApiRateLimit { retry_after: Option<u64> },

    #[error("API authentication error: {0}")]
    #[allow(dead_code)] // Used in EmbeddingApiClient; matched in response.rs
    ApiAuth(String),

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("OCR error: {0}")]
    Ocr(String),

    #[error("OCR unavailable: {0}")]
    OcrUnavailable(String),

    #[error("Transcription error: {0}")]
    Transcription(String),

    #[error("Transcription unavailable: {0}")]
    TranscriptionUnavailable(String),

    #[error("LLM error: {0}")]
    Llm(String),

    #[error("LLM unavailable: {0}")]
    LlmUnavailable(String),

    #[error("LLM rate limit exceeded, retry after {retry_after:?} seconds")]
    LlmRateLimit { retry_after: Option<u64> },

    #[error("Reranker error: {0}")]
    Reranker(String),
}

pub type Result<T> = std::result::Result<T, MomoError>;
