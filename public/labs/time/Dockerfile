FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      chrony \
      tzdata \
      procps \
      iproute2 \
      less \
      vim-tiny \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /var/lib/chrony /var/log/chrony /etc/chrony

# Zona horaria del laboratorio: se puede romper y reparar en el escenario 01.
RUN ln -sf /usr/share/zoneinfo/America/Mexico_City /etc/localtime \
 && echo 'America/Mexico_City' > /etc/timezone

COPY config/server.conf /etc/chrony/server.conf
COPY config/client.conf /etc/chrony/client.conf

EXPOSE 123/udp

CMD ["chronyd", "-d", "-f", "/etc/chrony/client.conf"]
