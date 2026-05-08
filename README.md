*This project has been created as part of the 42 curriculum by amoureau, elhirond, mathboye and zalemu*

# Description

Transcendence is a web application base for a financial analysis dashboard.

Current starter scope:

- Next.js web application with React and TypeScript.
- FastAPI analysis service reserved for future market analysis, scraping, ML, and AI helpers.
- PostgreSQL database managed from the web service with Prisma.
- Docker Compose setup for development and evaluation-like HTTPS mode.
- Database backup command through Docker.

# Instructions

Prerequisites:

- Docker with Docker Compose.
- Make.
- OpenSSL for local certificate generation.

Start the development environment:

```sh
make dev
```

Development mode starts `web`, `analysis`, and `db` with hot reload and plain HTTP:

- Web: http://localhost:3000
- Web health: http://localhost:3000/api/health
- Analysis health: http://localhost:8000/health

Start the evaluation-like environment:

```sh
make up
```

Evaluation-like mode builds the containers and exposes the app through nginx with HTTPS:

- HTTPS app: https://localhost

Useful commands:

```sh
make logs
make ps
make health
make db-shell
make reset-db
make backup
make down
make fclean
```

The first run copies `.env.example` to `.env`. Local secrets and generated certificates are ignored by Git.

If PostgreSQL authentication fails after pulling new Docker or environment changes, run:

```sh
make reset-db
```

This deletes only the local PostgreSQL Docker volume and recreates it from `.env`.

# Resources


# Team Information


# Project Management


# Technical Stack

- Web: Next.js, React, TypeScript, Tailwind CSS.
- Database ORM: Prisma.
- Analysis service: Python, FastAPI.
- Database: PostgreSQL 17 Alpine.
- HTTPS proxy: nginx.
- Containers: Docker Compose.

# Database Schema


# Features List


# Modules


# Individual Contributions

## amoureau

## elhirond

## mathboye

## zalemu
