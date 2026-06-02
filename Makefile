.PHONY: dev up down logs ps health db-push db-shell db-studio reset-db backup restore clean fclean certs dev-info up-info

COMPOSE = docker compose -f docker-compose.yml
COMPOSE_DEV = docker compose -f docker-compose.yml -f docker-compose.dev.yml

.env:
	cp .env.example .env

# dev starts the coding environment: hot reload, exposed ports, plain HTTP.
dev: .env
	$(COMPOSE_DEV) up -d --build --remove-orphans db analysis
	$(COMPOSE_DEV) build web
	$(COMPOSE_DEV) run --rm --no-deps web npm run db:push
	-$(COMPOSE_DEV) stop proxy
	$(COMPOSE_DEV) up -d --no-deps web
	$(MAKE) dev-info
	$(COMPOSE_DEV) logs -f db analysis web

# up starts the evaluation-like environment: built containers and HTTPS through nginx.
up: .env certs
	$(COMPOSE) up -d --build --remove-orphans db analysis web proxy
	$(COMPOSE) exec web npm run db:push
	$(MAKE) up-info

down:
	$(COMPOSE_DEV) down --remove-orphans

logs:
	$(COMPOSE_DEV) logs -f

ps:
	$(COMPOSE_DEV) ps

health:
	@curl -kfsS https://localhost/api/health 2>/dev/null || curl -fsS http://localhost:3000/api/health
	@printf '\n'
	@$(COMPOSE) exec analysis python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).read().decode())"
	@printf '\n'

db-push:
	$(COMPOSE_DEV) exec web npm run db:push

db-shell:
	$(COMPOSE_DEV) exec db sh -c 'psql -U "$$POSTGRES_USER" "$$POSTGRES_DB"'

db-studio:
	$(COMPOSE_DEV) exec web npm run db:studio

# reset-db deletes the local PostgreSQL Docker volume and recreates it from .env.
reset-db:
	$(COMPOSE_DEV) down --remove-orphans --volumes
	$(MAKE) dev

backup:
	mkdir -p backups
	$(COMPOSE) exec -T db sh -c 'pg_dump -U "$$POSTGRES_USER" "$$POSTGRES_DB"' > "backups/transcendence_$$(date +%Y%m%d_%H%M%S).sql"

restore:
	@test -n "$(file)" || (echo "Usage: make restore file=backups/name.sql" && exit 1)
	$(COMPOSE) exec -T db sh -c 'psql -U "$$POSTGRES_USER" "$$POSTGRES_DB"' < "$(file)"

certs:
	@if [ ! -f nginx/certs/server.crt ]; then \
		./scripts/generate-certs.sh; \
	fi

dev-info:
	@printf '\nDevelopment environment is ready:\n'
	@printf '  Web app:         http://localhost:3000\n'
	@printf '  Web health:      http://localhost:3000/api/health\n'
	@printf '  Analysis health: http://localhost:8000/health\n'
	@printf '\nUseful commands:\n'
	@printf '  make logs\n'
	@printf '  make ps\n'
	@printf '  make down\n\n'

up-info:
	@printf '\nEvaluation-like environment is ready:\n'
	@printf '  HTTPS app:       https://localhost\n'
	@printf '  HTTPS health:    https://localhost/api/health\n'
	@printf '\nThe HTTPS certificate is self-signed, so the browser warning is expected.\n'
	@printf '\nUseful commands:\n'
	@printf '  make logs\n'
	@printf '  make ps\n'
	@printf '  make down\n\n'

clean:
	$(COMPOSE_DEV) down --remove-orphans

fclean:
	$(COMPOSE_DEV) down --remove-orphans --volumes
	rm -rf nginx/certs
