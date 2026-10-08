output "bucket_name" {
  description = "Name of the created S3 bucket"
  value       = aws_s3_bucket.meridian_demo.bucket
}

output "bucket_arn" {
  description = "ARN of the created S3 bucket"
  value       = aws_s3_bucket.meridian_demo.arn
}

output "bucket_tags" {
  description = "Tags applied to the S3 bucket"
  value       = aws_s3_bucket.meridian_demo.tags
}
