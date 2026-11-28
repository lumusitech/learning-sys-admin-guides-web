#!/usr/bin/env bash
set -euo pipefail

for user in alice bob; do
  if ! id "$user" >/dev/null 2>&1; then
    useradd -m -s /bin/bash "$user"
  fi
  echo "$user:$user" | chpasswd
  install -d -m 700 -o "$user" -g "$user" \
    "/home/$user/Maildir" \
    "/home/$user/Maildir/cur" \
    "/home/$user/Maildir/new" \
    "/home/$user/Maildir/tmp"
done

cat > /etc/dovecot/users <<'EOF'
alice:{PLAIN}alice
bob:{PLAIN}bob
EOF
chmod 644 /etc/dovecot/users

mkdir -p /run/dovecot /var/log

if [ ! -f /etc/postfix/main.cf ]; then
  cp /usr/share/postfix/main.cf.debian /etc/postfix/main.cf
fi
touch /var/log/mail.log /var/log/dovecot.log

postconf -e 'myhostname = mail.lab.local'
postconf -e 'mydomain = lab.local'
postconf -e 'mydestination = lab.local, localhost, localhost.localdomain'
postconf -e 'inet_interfaces = all'
postconf -e 'inet_protocols = ipv4'
postconf -e 'home_mailbox = Maildir/'
postconf -e 'mynetworks = 127.0.0.0/8 172.16.0.0/12 192.168.65.0/24'
postconf -e 'relayhost ='
postconf -e 'maillog_file = /var/log/mail.log'
postconf -e 'smtpd_relay_restrictions = permit_mynetworks, reject_unauth_destination'

newaliases
postfix check
postfix start
dovecot

exec tail -F /var/log/mail.log /var/log/dovecot.log
