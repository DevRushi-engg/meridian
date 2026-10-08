variable "aws_region" {
  description = "AWS region where resources are provisioned"
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "Name of the demonstration S3 bucket (must be globally unique)"
  type        = string
  default     = "meridian-drift-demo-bucket"
}

variable "environment" {
  description = "Deployment environment tag (e.g. development, staging, production)"
  type        = string
  default     = "development"
}

variable "project" {
  description = "Project name tag"
  type        = string
  default     = "meridian"
}
