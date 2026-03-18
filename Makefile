.PHONY: dev stop logs db-migrate db-upgrade shell clean

dev:
	docker compose up --build

stop:
	docker compose down

logs:
	docker compose logs -f

db-migrate:
	docker compose exec backend uv run flask db migrate

db-upgrade:
	docker compose exec backend uv run flask db upgrade

shell:
	docker compose exec backend uv run flask shell

clean:
	docker compose down -v
