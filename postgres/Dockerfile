FROM postgres:17-alpine

COPY init.sql /docker-entrypoint-initdb.d/

VOLUME /var/lib/postgresql/data

ENV POSTGRES_PASSWORD=postgres
ENV POSTGRES_USER=postgres
ENV POSTGRES_DB=app_db