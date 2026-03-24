terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.region
}

locals {
  common_tags = merge(var.tags, {
    cig-managed = "true"
    module      = "neo4j"
  })

  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail

    dnf update -y
    dnf install -y docker awscli xfsprogs
    systemctl enable --now docker

    ATTACHMENT_DEVICE="/dev/xvdf"
    DEVICE_NAME=""
    MOUNT_POINT="/srv/neo4j"

    mkdir -p "$MOUNT_POINT"

    for attempt in $(seq 1 30); do
      if [ -b /dev/nvme1n1 ]; then
        DEVICE_NAME="/dev/nvme1n1"
        break
      fi
      if [ -b "$ATTACHMENT_DEVICE" ]; then
        DEVICE_NAME="$ATTACHMENT_DEVICE"
        break
      fi
      sleep 2
    done

    if [ -z "$DEVICE_NAME" ]; then
      echo "Neo4j data device was not attached in time" >&2
      exit 1
    fi

    if ! blkid "$DEVICE_NAME" >/dev/null 2>&1; then
      mkfs -t xfs "$DEVICE_NAME"
    fi

    if ! mountpoint -q "$MOUNT_POINT"; then
      mount "$DEVICE_NAME" "$MOUNT_POINT"
    fi

    UUID=$(blkid -s UUID -o value "$DEVICE_NAME")
    grep -q "$UUID" /etc/fstab || echo "UUID=$UUID $MOUNT_POINT xfs defaults,nofail 0 2" >> /etc/fstab

    mkdir -p "$MOUNT_POINT/data" "$MOUNT_POINT/logs"

    NEO4J_PASSWORD=$(aws secretsmanager get-secret-value \
      --secret-id "${aws_secretsmanager_secret.neo4j_password.id}" \
      --region "${var.region}" \
      --query SecretString \
      --output text)

    TOKEN=$(curl -fsX PUT "http://169.254.169.254/latest/api/token" \
      -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
    INSTANCE_PRIVATE_IP=$(curl -fsS \
      -H "X-aws-ec2-metadata-token: $${TOKEN}" \
      http://169.254.169.254/latest/meta-data/local-ipv4)

    docker pull neo4j:${var.neo4j_version}
    docker rm -f neo4j || true
    docker run -d \
      --name neo4j \
      --restart unless-stopped \
      -p 7687:7687 \
      -e NEO4J_AUTH=neo4j/$${NEO4J_PASSWORD} \
      -e NEO4J_server_default__advertised__address=$${INSTANCE_PRIVATE_IP} \
      -e NEO4J_server_bolt_advertised__address=$${INSTANCE_PRIVATE_IP}:7687 \
      -v "$MOUNT_POINT/data:/data" \
      -v "$MOUNT_POINT/logs:/logs" \
      neo4j:${var.neo4j_version}
  EOF
}

resource "random_password" "neo4j" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "neo4j_password" {
  name                    = "${var.name_prefix}/neo4j/password"
  recovery_window_in_days = 7

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-neo4j-password"
  })
}

resource "aws_secretsmanager_secret_version" "neo4j_password" {
  secret_id     = aws_secretsmanager_secret.neo4j_password.id
  secret_string = random_password.neo4j.result
}

resource "aws_iam_role" "neo4j" {
  name = "${var.name_prefix}-neo4j-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.neo4j.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "secrets" {
  name = "${var.name_prefix}-neo4j-secrets"
  role = aws_iam_role.neo4j.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ]
      Resource = [aws_secretsmanager_secret.neo4j_password.arn]
    }]
  })
}

resource "aws_iam_instance_profile" "neo4j" {
  name = "${var.name_prefix}-neo4j-profile"
  role = aws_iam_role.neo4j.name

  tags = local.common_tags
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "neo4j" {
  ami                         = data.aws_ami.amazon_linux_2023.id
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [var.security_group_id]
  iam_instance_profile        = aws_iam_instance_profile.neo4j.name
  associate_public_ip_address = false
  user_data                   = local.user_data

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    delete_on_termination = false
    encrypted             = true
  }

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-neo4j"
  })
}

resource "aws_ebs_volume" "data" {
  availability_zone = aws_instance.neo4j.availability_zone
  size              = var.volume_size_gb
  type              = "gp3"
  encrypted         = true

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-neo4j-data"
  })
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/xvdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.neo4j.id
}
