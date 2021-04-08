#!/bin/bash

path="../msoe-sislisten"

if [ $# == 0 ]; then
	echo ">>> Using default path ($path)"
else
	$path=$1
fi


if command -v python3 >/dev/null 2>&1
then
	echo "starting sislisten server!"
	cd $path
	python3 -m pip install -r requirements.txt
	python3 server.py
fi

