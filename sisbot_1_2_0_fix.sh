#!/usr/bin/env bash

cd /home/pi/sisbot-server/sisbot

git config --global user.name Sisyphus
git config --global user.email pi@sisyphus-industries.com
git reset --hard a7438e8e6a48138e521bbf328d9e259116aad2e6
git pull origin master
