resource "aws_s3_bucket" "meridian_demo" {
  bucket = var.bucket_name

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Project     = var.project
  }
}

resource "aws_s3_bucket_versioning" "meridian_demo_versioning" {
  bucket = aws_s3_bucket.meridian_demo.id

  versioning_configuration {
    status = "Enabled"
  }
}
