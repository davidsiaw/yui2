#!/bin/sh
apk add --update --no-cache ffmpeg autoconf automake make libtool python build-base git

npm install -g node-gyp@3.6.2

cd /srv && npm install node-opus@0.2.7 && npm install

apk del autoconf automake make libtool git build-base linux-headers pcre-dev openssl-dev
rm -rf /var/cache/apk/*
