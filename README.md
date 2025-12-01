<div align="center">
  <img src="./frontend/public/logo_se.png" width="100px" />
  <h1>FM Playground</h1>
  <a href="https://play.formal-methods.net/"><img src="https://img.shields.io/website?url=https%3A%2F%2Fplay.formal-methods.net%2F&label=play.formal-methods.net" alt="FM Playground"></a>
  <img src="https://img.shields.io/github/issues/fm4se/fm-playground" alt="GitHub issues">
  <img src="https://img.shields.io/github/license/fm4se/fm-playground" alt="GitHub License">
  <!-- <img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fwakapi.soaib.me%2Fapi%2Fcompat%2Fshields%2Fv1%2Fsoaib%2Finterval%3Aany%2Fproject%3Afm-playground&style=flat&label=dev&color=%233b71ca" alt="Wakapi"> -->
  <hr>
</div>

A web-based platform for formal methods tools, providing an easy-to-use interface for model checking, formal verification, and synthesis. Currently, Limboole, Z3, nuXmv, Alloy, dafny, and Spectra are integrated into the platform. Due to the modular architecture, more tools can be added easily.

## Overview and Examples

We started a small overview of the features of the FM Playground and how to use it. The video playlist is available on [YouTube](https://www.youtube.com/playlist?list=PLGyeoukah9NYq9ULsIuADG2r2QjX530nf)

<div align="center">

[![Formal Methods Playground](./docs/assets/img/fmp-tutorial.jpg)](https://www.youtube.com/playlist?list=PLGyeoukah9NYq9ULsIuADG2r2QjX530nf)

</div>

For more updates, examples, and tutorials, please visit the [formal-methods.net](https://formal-methods.net) website.

## Development

### Requirements

- Python >= 3.10.0
- Node >= 20.0.0
- PostgreSQL >= 15.0 (optional) - use sqlite3 for development
- Docker >= 20.10.0 (optional)
- Docker Compose >= 1.27.0 (optional)

### Installation

- [TODO]

### Development Server

For local development, you can use the following script to start the development server:

- Unix-based systems (Linux, macOS): `./start_dev.sh`
- Windows: `start_dev.ps1`
  It will ask you which services you want to start (frontend, backend, tools). You can select multiple services by separating them with commas.

NOTE: In windows, you might experience issues with the script execution policy.

### Docker

- [TODO]

### Docker Compose

- Copy the `.env.example` file to `.env` and update the environment variables as needed:

```bash
cp .env.example .env
```

- Run the following command:

```bash
docker compose up -d
```

## Contributing

TODO: Create a contributing guide

## License

This project is licensed under the [MIT License](LICENSE).

### Third-Party Licenses

- Limboole - https://github.com/maximaximal/limboole/blob/master/LICENSE
- Z3 - https://github.com/Z3Prover/z3/blob/master/LICENSE.txt
- nuXmv - https://nuxmv.fbk.eu/downloads/LICENSE.txt
- Alloy - https://github.com/AlloyTools/org.alloytools.alloy/blob/master/LICENSE
- Dafny - https://github.com/dafny-lang/dafny/blob/master/LICENSE.txt
- Spectra - https://github.com/SpectraSynthesizer/spectra-synt/blob/master/LICENSE
