#!/usr/bin/env bash

# kill running node processes
ps aux | grep " server.js" | grep -v grep
nodepids=$(ps aux | grep " server.js" | grep -v grep | cut -c10-15)
#echo "OK, so we will stop these process/es now..."
for nodepid in ${nodepids[@]}
do
echo "Stopping PID :"$nodepid >> restart.log
sudo kill -9 $nodepid
done

# remove state
cd /home/pi/sisbot-server/sisproxy/
rm state.json

# remove status
# cd /home/pi/sisbot-server/sisbot/content/
# rm status.json

# reset sisbot
cd /home/pi/sisbot-server/sisbot
if [ -n "$1" ]; then
	git reset --hard "$1"
else
	git reset --hard
fi
sudo rm -rf node_modules

# reset siscloud
cd /home/pi/sisbot-server/siscloud
if [ -n "$2" ]; then
	git reset --hard "$2"
else
	git reset --hard
fi
sudo rm -rf node_modules

# fix permissions
chown -R pi:pi /home/pi/sisbot-server/

# reinstall node modules
# cd /home/pi/sisbot-server/sisbot
# su - pi -c npm install
# cd /home/pi/sisbot-server/siscloud
# su - pi -c npm install

# fix permissions yet again
# chown -R pi /home/pi/sisbot-server/

# restart server
cd /home/pi/sisbot-server/sisproxy
sudo NODE_ENV=sisbot node server.js >> /var/log/sisyphus/proxy.log  2>&1

echo "Revert Reset complete"
