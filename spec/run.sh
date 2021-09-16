for file in $(find spec -path '*/scripts/*.sh')
do
    bash "$file"
done