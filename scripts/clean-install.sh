#!/usr/bin/env bash

# Remove everything that's created when you run `npm i` for the first time and 
# reinstall all dependencies

rm -rf ./node_modules;

rm -rf ./package-lock.json;

npm install;
