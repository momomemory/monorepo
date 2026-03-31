use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

use crate::error::MomoError;

impl IntoResponse for MomoError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            MomoError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            MomoError::Validation(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            MomoError::Database(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
            MomoError::Embedding(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.clone()),
            MomoError::Processing(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.clone()),
            MomoError::Http(e) => (StatusCode::BAD_GATEWAY, e.to_string()),
            MomoError::Json(e) => (StatusCode::BAD_REQUEST, e.to_string()),
            MomoError::Io(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
            MomoError::UrlParse(e) => (StatusCode::BAD_REQUEST, e.to_string()),
            MomoError::ApiRateLimit { .. } => (StatusCode::TOO_MANY_REQUESTS, self.to_string()),
            MomoError::ApiAuth(msg) => (StatusCode::UNAUTHORIZED, msg.clone()),
            MomoError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.clone()),
            MomoError::Ocr(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.clone()),
            MomoError::OcrUnavailable(msg) => (StatusCode::SERVICE_UNAVAILABLE, msg.clone()),
            MomoError::Transcription(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.clone()),
            MomoError::TranscriptionUnavailable(msg) => {
                (StatusCode::SERVICE_UNAVAILABLE, msg.clone())
            }
            MomoError::Llm(msg) => (StatusCode::BAD_GATEWAY, msg.clone()),
            MomoError::LlmUnavailable(msg) => (StatusCode::SERVICE_UNAVAILABLE, msg.clone()),
            MomoError::LlmRateLimit { retry_after } => (
                StatusCode::TOO_MANY_REQUESTS,
                format!("LLM rate limit exceeded, retry after {retry_after:?} seconds"),
            ),
            MomoError::Reranker(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.clone()),
        };

        let body = Json(json!({
            "error": message,
            "code": status.as_u16()
        }));

        (status, body).into_response()
    }
}
