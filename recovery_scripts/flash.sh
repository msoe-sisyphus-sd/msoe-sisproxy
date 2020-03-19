!/bin/sh

while :
do
        echo 0 > /sys/class/gpio/gpio3/value
        sleep 0.5
        echo 1 > /sys/class/gpio/gpio3/value
        sleep 0.5

done
