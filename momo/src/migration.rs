use crate::db::traits::DatabaseBackend;
use crate::embeddings::EmbeddingProvider;
use crate::error::Result;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DimensionMismatchPolicy {
    Reject,
    Rebuild,
    Prompt,
}

pub enum MigrationDecision {
    NotNeeded,
    Approved,
    Rejected,
}

/// Check if embedding dimensions are compatible with the database.
///
/// If dimensions mismatch, handle it according to the selected policy.
pub async fn check_dimension_compatibility(
    db: &dyn DatabaseBackend,
    provider: &EmbeddingProvider,
    policy: DimensionMismatchPolicy,
) -> Result<MigrationDecision> {
    let model_dimensions = provider.dimensions();
    let stored_dimensions = db.get_embedding_dimensions().await?;

    match stored_dimensions {
        None => {
            tracing::info!(
                "Fresh database, storing embedding dimensions: {}",
                model_dimensions
            );
            db.set_embedding_dimensions(model_dimensions).await?;
            Ok(MigrationDecision::NotNeeded)
        }
        Some(db_dims) if db_dims == model_dimensions => {
            tracing::info!("Embedding dimensions match: {}", model_dimensions);
            Ok(MigrationDecision::NotNeeded)
        }
        Some(db_dims) => {
            tracing::warn!(
                "Dimension mismatch: database has {} dimensions, model produces {}",
                db_dims,
                model_dimensions
            );

            match policy {
                DimensionMismatchPolicy::Rebuild => {
                    tracing::info!("Dimension mismatch policy is rebuild, proceeding with migration");
                    Ok(MigrationDecision::Approved)
                }
                DimensionMismatchPolicy::Reject => Ok(MigrationDecision::Rejected),
                DimensionMismatchPolicy::Prompt => {
                    Err(crate::error::MomoError::Internal(
                        "Interactive embedding migration prompts are no longer supported; use an explicit migration policy".to_string(),
                    ))
                }
            }
        }
    }
}

/// Trigger re-embedding of all documents.
///
/// This marks all documents as 'queued' and updates the stored dimensions.
/// The background pipeline will then re-embed them.
pub async fn trigger_reembedding(db: &dyn DatabaseBackend, new_dimensions: usize) -> Result<()> {
    tracing::info!(
        "Starting re-embedding migration to {} dimensions",
        new_dimensions
    );

    db.queue_all_documents_for_reprocessing().await?;

    db.delete_all_chunks().await?;

    db.set_embedding_dimensions(new_dimensions).await?;

    tracing::info!("Migration prepared: documents queued for re-embedding");

    Ok(())
}
