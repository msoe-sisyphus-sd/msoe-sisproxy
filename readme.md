# README

## Bluetooth
- sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
- npm install bleno
-

## To Run Sisyphus

- cd ~/sisbot-server/sisproxy/
- sudo NODE_ENV=sisbot node server.js

## Special Run modes (run within sisproxy folder)

- sudo NODE_ENV=sisbot_stopped node server.js   (runs without autostarting any tracks)
- sudo NODE_ENV=sisbot_dummy node server.js   (runs without connecting to Serial port: for testing web app, disconnected bots)

## Certificates

- sudo apt-get install letsencrypt

## Renew Certificates

- sudo -H letsencrypt renew

## For New Certificates

- cd /opt/letsencrypt
- sudo -H ./letsencrypt-auto certonly --standalone -d www.example.com
- sudo -H letsencrypt certonly --standalone -d www.example.com

## Find Certificates

- /etc/letsencrypt/live/[domain]/chain.pem
- /etc/letsencrypt/live/[domain]/fullchain.pem
- /etc/letsencrypt/live/[domain]/privkey.pem

## Self Signed Certificates
- openssl genrsa -out <name>.key
- openssl req -new -key <name>.key -days 3650 -out <name>.csr
- openssl x509 -req -days 3650 -in <name>.csr -signkey <name>.key -out <name>.crt

## Helpful Commands
- sudo lsof -i -P | grep node | wc -l // node processes with ports open
- pkill -f node
- shell script you put on deploy. Tell stations to update in the binary. If exec.sh file, it will run that file
- git.withease.io
- sudo killall node will kill all active node processes

## New Git Repos

#### On server
- log in to server
- cd /services/
- mkdir <service_folder>
- cd /git/
- git init --bare <reponame>.git
- cd <reponame>.git/hooks/
- vim post-receive
#!/bin/sh
git --work-tree=/services/<service_folder> --git-dir=/git/<reponame>.git checkout -f
- update permissions
	chmod +x post-receive

#### On Client
git init

git remote set-url <servername> pi@sisyphus.withease.io:/git/<reponame>.git
OR
git remote add <servername> pi@sisyphus.withease.io:/git/<reponame>.git

git pull origin master
