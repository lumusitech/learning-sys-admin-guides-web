FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      openssh-server \
      sudo \
      passwd \
      libpam-modules \
      libpam-pwquality \
      pamtester \
      acl \
      procps \
      iproute2 \
      less \
      vim-tiny \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY sshd_config /etc/ssh/sshd_config
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod 755 /usr/local/bin/entrypoint.sh \
 && mkdir -p /run/sshd /var/run/sshd \
 && ssh-keygen -A

EXPOSE 22

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
