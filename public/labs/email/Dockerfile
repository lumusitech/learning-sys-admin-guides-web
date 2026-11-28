FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN echo "postfix postfix/main_mailer_type select No configuration" | debconf-set-selections \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      postfix \
      dovecot-core \
      dovecot-imapd \
      swaks \
      curl \
      procps \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY dovecot.conf /etc/dovecot/dovecot.conf
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod 755 /usr/local/bin/entrypoint.sh

EXPOSE 25 143

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
