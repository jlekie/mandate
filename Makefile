NPM := $(shell command -v npm 2> /dev/null)
YARN := $(shell command -v yarn 2> /dev/null)

default: build

setup: check-env yarn-install
build: node-build
publish: npm-publish

check-env:
ifndef NPM
	$(error npm is not installed)
endif
ifndef YARN
	$(error yarn is not installed)
endif

yarn-install:
	yarn install
gulp-build:
	gulp build
npm-publish:
	npm publish dist --access=public

node-build:
ifndef COMSPEC
	@node_modules\.bin\ts-node scripts\build.ts
else
	@node_modules/.bin/ts-node scripts/build.ts
endif