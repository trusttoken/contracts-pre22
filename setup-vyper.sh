#!/bin/bash

set -e

if ! [ -x "$(command -v vyper)" ]; then
  docker -v > /dev/null
  function vyper() {
      relative_args=()
      for arg in "$@"; do
          if [ -f  "${arg}" ]; then
            relative_args+=("./$(python -c "import os.path; print os.path.relpath('${arg}', '$(pwd)')")")
          else
            relative_args+=("${arg}")
          fi
      done

      docker run -v $(pwd):/code ethereum/vyper "${relative_args[@]}"
  }
  export -f vyper
fi
