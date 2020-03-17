#!/usr/bin/env bash

# kill node application
# sudo killall node

# create directories to be archived
mkdir /home/pi/sis_recovery/protected_backup/recovery

# copy sisbot
cp -rp /home/pi/sisbot-server/sisbot /home/pi/sis_recovery/protected_backup/recovery/sisbot
cd /home/pi/sis_recovery/protected_backup/recovery/sisbot
git reset --hard ecea860a2156b8b91524045584aecd1fa0b7f3dc

# copy siscloud
cp -rp /home/pi/sisbot-server/siscloud /home/pi/sis_recovery/protected_backup/recovery/siscloud
cd /home/pi/sis_recovery/protected_backup/recovery/siscloud
git reset --hard e1da68217ebdb8fa0610bdc797c7eb3e40b28345

# copy sisproxy
cp -rp /home/pi/sisbot-server/sisproxy /home/pi/sis_recovery/protected_backup/recovery/sisproxy
cd /home/pi/sis_recovery/protected_backup/recovery/sisproxy
git reset --hard

# move to recovery folder
cd /home/pi/sis_recovery/protected_backup

# delete old archive
sudo rm recovery.tar.gz

# create new archive
sudo tar cvzf recovery.tar.gz recovery

cd /home/pi

# protect archive
chmod 400 /home/pi/sis_recovery/protected_backup/recovery.tar.gz

# cleanup
sudo rm -rf /home/pi/sis_recovery/protected_backup/recovery

echo "Archive refreshed"
