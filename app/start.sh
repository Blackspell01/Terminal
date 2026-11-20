#!/bin/sh
# Startskript des Terminal-Containers
set -eu

# Zsh-Config aus dem Image ins gemountete Volume übernehmen
cp -f /root/.zshrc /app/omz/.zshrc
# Pro Benutzer ~/.zshrc.local laden ($HOME wird erst in der Shell ausgewertet)
echo '[ -r "$HOME/.zshrc.local" ] && source "$HOME/.zshrc.local"' >> /app/omz/.zshrc

# Oh My Zsh übernehmen: Inhalt kopieren, nicht den Ordner (sonst entsteht .oh-my-zsh/.oh-my-zsh)
mkdir -p /app/omz/.oh-my-zsh
cp -a /root/.oh-my-zsh/. /app/omz/.oh-my-zsh/
sed -i '/^export ZSH=/d' /app/omz/.zshrc

# Die Shell läuft per nsenter auf dem Host, dort existiert /app/omz nicht.
# Deshalb den Host-Pfad des Mounts ermitteln und als OMZ_DIR an server.js geben.
DEVNO=$(awk '$5=="/app/omz"{print $3}' /proc/self/mountinfo)
ROOT=$(awk '$5=="/app/omz"{print $4}' /proc/self/mountinfo)
MNT=$(awk -v dev="$DEVNO" '$3==dev{print $5; exit}' /proc/1/mountinfo)
export OMZ_DIR="${MNT}${ROOT}"

exec node server.js