
# Curator Service
Curator Micro-service for photo stack generation based on geo-location.
[Lensity repo](https://github.com/preposterous-kumquat/preposterous-kumquat)
## Team

  - __Product Owner__: [Josphine Eng](https://github.com/ChirpingMermaid)
  - __Scrum Master__: [Julie Truong](https://github.com/Truong-Julie)
  - __Development Team Members__: [Brian Kilrain](https://github.com/bkilrain)

## Table of Contents

1. [Team](#team)
1. [Usage](#usage)
1. [Docker Development](#docker-development)
    1. [Build Image](#build-image)
1. [Contributing](#contributing)

## Usage
Curator micro-service. 

- GET /getstack: 
Web server from [Lensity](https://github.com/preposterous-kumquat/preposterous-kumquat) sends GET /getstack request to curator service to generate stacks of similar photos based on [similarity server](https://github.com/preposterous-kumquat/similarityServer) matching. Curator parses returned stacks to generate evenly spaced photos from around the world.

- POST /save 
Saves photos into redis cache to stack generation

- GET /getRandStack 
Grab the 6 most recently saved stacks and sends it back to the user

## Docker Development

### Build Image

In root folder run:
```sh
docker build -t curator:01 .
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
