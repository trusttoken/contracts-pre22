#!/bin/bash
set -eu

extract_json() {
    local json_file="$1"
    local key="$2"

    local python_command="import json,sys;obj=json.load(sys.stdin);print(obj['${key}'])"
    python3 -c "${python_command}" < "${json_file}"
}

extract_version() {
    local text="$1"

    [[ "${text}" =~ [0-9\.]+ ]]
    echo "${BASH_REMATCH}"
}

setup_solc() {
    echo "Setting up solc..." >&2
    local solc_version="$(extract_version "$(solc --version)")"
    local compiler_version="$(extract_version "$(extract_json .waffle.json compilerVersion)")"

    echo "Found solc version ${solc_version} and Waffle compiler version ${compiler_version}." >&2
    if [[ "${solc_version}" != "${compiler_version}" ]]; then
        echo "Updating solc version to ${compiler_version}..." >&2
        pip3 install solc-select
        solc-select install "${compiler_version}"
        solc-select use "${compiler_version}"
    fi
}

setup_certora() {
    echo "Setting up Certora..." >&2
    local certora_version="$(extract_version "$(certoraRun --version)")"
    local latest_version="$(extract_version "$(pip3 index versions certora-cli)")"

    echo "Found Certora version ${certora_version} and latest version ${latest_version}." >&2
    if [[ "${certora_version}" != "${latest_version}" ]]; then
        echo "Updating Certora version to ${latest_version}..." >&2
        pip3 install certora-cli --upgrade
    fi
}

get_certora_solc_args() {
    echo "Getting solc args for Certora..." >&2
    # TODO extract these from .waffle.json
    local certora_solc_args="['--optimize', '--optimize-runs', '200']"

    echo "Found solc args for Certora: ${certora_solc_args}" >&2
    echo "${certora_solc_args}"
}

main() {
    setup_solc
    setup_certora

    local certora_solc_args="$(get_certora_solc_args)"

    for file in $(find spec -path '*/scripts/*.sh'); do
        # bash "$file"

        # TODO Update all scripts to config files.
        # Pass in these variables so we can standardize calls to certoraRun
        local dependencyFiles="contracts/truefi2/BorrowingMutex.sol"
        local contract="BorrowingMutex"
        local specFile="spec/truefi2/BorrowingMutex.spec"

        set -x
        : certoraRun "${dependencyFiles}" \
            --verify "${contract}:${specFile}" \
            --optimistic_loop \
            --rule_sanity \
            --short_output \
            --solc_args "${certora_solc_args}"
        set +x
    done
}

main "$@"
