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
  region                      = var.region
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true
}

data "aws_availability_zones" "available" {
  state = "available"
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

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 1)

  tag_prefix                  = "cig-authentik-sso"
  resolved_oidc_client_secret = var.oidc_client_secret != "" ? var.oidc_client_secret : random_password.oidc_client_secret.result

  common_tags = merge(var.tags, {
    cig-managed = "true"
    module      = "authentik-host"
    Stack       = "authentik-sso"
    Component   = "authentik"
  })

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    region                      = var.region
    domain                      = var.domain
    tls_alt_domain              = var.tls_alt_domain
    admin_email                 = var.admin_email
    authentik_image_tag         = var.authentik_image_tag
    smtp_host                   = var.smtp_host
    smtp_port                   = var.smtp_port
    smtp_username               = var.smtp_username
    smtp_password               = var.smtp_password
    smtp_from                   = var.smtp_from
    oidc_client_id              = var.oidc_client_id
    oidc_client_secret          = local.resolved_oidc_client_secret
    google_auth_client_id       = var.google_auth_client_id
    google_auth_client_secret   = var.google_auth_client_secret
    github_auth_client_id       = var.github_auth_client_id
    github_auth_client_secret   = var.github_auth_client_secret
    dashboard_url               = var.dashboard_url
    redirect_uris               = jsonencode(var.redirect_uris)
    authentik_secret_key_id     = aws_secretsmanager_secret.authentik_secret_key.id
    authentik_admin_password_id = aws_secretsmanager_secret.authentik_admin_password.id
    db_password_id              = aws_secretsmanager_secret.db_password.id
  })
}

check "social_login_inputs" {
  assert {
    condition = (
      var.google_auth_client_id != "" &&
      var.google_auth_client_secret != "" &&
      var.github_auth_client_id != "" &&
      var.github_auth_client_secret != ""
    )

    error_message = "Google and GitHub OAuth credentials are required to seed the Authentik social-login flows."
  }
}

resource "aws_vpc" "authentik" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-vpc"
  })
}

resource "aws_internet_gateway" "authentik" {
  vpc_id = aws_vpc.authentik.id

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-igw"
  })
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.authentik.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = local.azs[0]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-public-1"
    Tier = "public"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.authentik.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.authentik.id
  }

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-public-rt"
  })
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "host" {
  name        = "${var.name_prefix}-host-sg"
  description = "Allow public HTTPS access to the Authentik host"
  vpc_id      = aws_vpc.authentik.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-host-sg"
  })
}

resource "aws_security_group_rule" "ssh" {
  count             = var.ssh_public_key != "" ? 1 : 0
  type              = "ingress"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  security_group_id = aws_security_group.host.id
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "SSH"
}

resource "aws_key_pair" "host" {
  count      = var.ssh_public_key != "" ? 1 : 0
  key_name   = "${var.name_prefix}-key"
  public_key = var.ssh_public_key

  tags = local.common_tags
}

resource "aws_iam_role" "host" {
  name = "${var.name_prefix}-host-role"

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
  role       = aws_iam_role.host.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "secrets" {
  name = "${var.name_prefix}-host-secrets"
  role = aws_iam_role.host.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
      ]
      Resource = [
        aws_secretsmanager_secret.authentik_secret_key.arn,
        aws_secretsmanager_secret.authentik_admin_password.arn,
        aws_secretsmanager_secret.db_password.arn,
      ]
    }]
  })
}

resource "aws_iam_role_policy" "route53_dns" {
  name = "${var.name_prefix}-host-route53-dns"
  role = aws_iam_role.host.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "route53:ChangeResourceRecordSets",
          "route53:ListResourceRecordSets",
        ]
        Resource = "arn:aws:route53:::hostedzone/${var.route53_zone_id}"
      },
      {
        Effect = "Allow"
        Action = [
          "route53:GetChange",
          "route53:ListHostedZones",
          "route53:ListHostedZonesByName",
        ]
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_instance_profile" "host" {
  name = "${var.name_prefix}-host-profile"
  role = aws_iam_role.host.name

  tags = local.common_tags
}

resource "aws_instance" "authentik" {
  ami                         = data.aws_ami.amazon_linux_2023.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.host.id]
  iam_instance_profile        = aws_iam_instance_profile.host.name
  associate_public_ip_address = true
  key_name                    = var.ssh_public_key != "" ? aws_key_pair.host[0].key_name : null
  user_data                   = local.user_data
  user_data_replace_on_change = false

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size_gb
    delete_on_termination = true
    encrypted             = true

    tags = merge(local.common_tags, {
      Name = "${var.name_prefix}-root-disk"
    })
  }

  tags = merge(local.common_tags, {
    Name = "${local.tag_prefix}-host"
  })

  lifecycle {
    ignore_changes = [ami, user_data]
  }
}

resource "aws_eip" "authentik" {
  domain   = "vpc"
  instance = aws_instance.authentik.id

  tags = merge(local.common_tags, {
    Name = "${local.tag_prefix}-eip"
  })
}

resource "aws_route53_record" "authentik" {
  zone_id         = var.route53_zone_id
  name            = var.domain
  type            = "A"
  ttl             = 60
  records         = [aws_eip.authentik.public_ip]
  allow_overwrite = true
}

resource "aws_route53_record" "authentik_alt" {
  zone_id         = var.route53_zone_id
  name            = var.tls_alt_domain
  type            = "A"
  ttl             = 60
  records         = [aws_eip.authentik.public_ip]
  allow_overwrite = true
}
