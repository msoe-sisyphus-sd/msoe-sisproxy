#!/bin/bash

# Setup the Pins as GPIO
echo 2 > /sys/class/gpio/export
echo 3 > /sys/class/gpio/export
echo 4  > /sys/class/gpio/export

# Set the pin directions
echo in > /sys/class/gpio/gpio2/direction
echo out > /sys/class/gpio/gpio3/direction
echo out > /sys/class/gpio/gpio4/direction

# Preset the LEDs to off
echo 1 > /sys/class/gpio/gpio3/value
echo 1 > /sys/class/gpio/gpio4/value

