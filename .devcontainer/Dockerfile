ARG VARIANT="24-trixie"

FROM mcr.microsoft.com/devcontainers/typescript-node:${VARIANT}

# GPG is used to sign commits. 
# See https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials#_sharing-gpg-keys
# You probably also need to put "use-agent" in your ~/.gnupg/gpg.conf and "pinentry-program /bin/pinentry-mac" in your ~/.gnupg/gpg-agent.conf on your WSL instance.
# To list your keys you can use the command (works only in your devcontainer and not the WSL instance):
# gpg --list-secret-keys --keyid-format=long
RUN apt-get update && apt-get -y install gnupg

RUN su node -c "npm install --location=global pnpm turbo @changesets/cli"
