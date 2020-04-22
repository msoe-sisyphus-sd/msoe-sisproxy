#!/usr/bin/env bash
#echo "The following node processes were found:"
ps aux | grep " server.js" | grep -v grep
nodepids=$(ps aux | grep " server.js" | grep -v grep | cut -c10-15)
#echo "OK, so we will stop these process/es now..."
for nodepid in ${nodepids[@]}
do
echo "Stopping PID :"$nodepid >> restart.log
sudo kill -9 $nodepid
done

cd /home/pi/sisbot-server/sisproxy
if [ -n "$1" ]; then
  sudo NODE_ENV="$1" node server.js >> /var/log/sisyphus/proxy.log  2>&1 &
else
  sudo NODE_ENV=sisbot node server.js >> /var/log/sisyphus/proxy.log  2>&1 &
fi
echo "Node restarted"
