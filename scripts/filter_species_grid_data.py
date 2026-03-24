#!/usr/bin/env python3

import argparse
import ast
import csv
import gzip
import json
from pathlib import Path


def load_traits_species(traits_path: Path) -> set[str]:
    species = set()
    with traits_path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            value = (row.get("species") or "").strip()
            if value:
                species.add(value)
    return species


def filter_grid_rows(grid_path: Path, allowed_species: set[str]) -> tuple[list[dict[str, object]], dict[str, int]]:
    rows: list[dict[str, object]] = []
    grid_unique_species = set()
    matched_unique_species = set()
    grid_species_occurrences = 0
    matched_occurrences = 0
    matched_cells = 0

    with grid_path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            raw_list = (row.get("sci_name_list") or "").strip()
            species_list = ast.literal_eval(raw_list) if raw_list else []
            filtered_species = [species for species in species_list if species in allowed_species]

            if filtered_species:
                matched_cells += 1

            for species in species_list:
                grid_unique_species.add(species)
                grid_species_occurrences += 1

            for species in filtered_species:
                matched_unique_species.add(species)
                matched_occurrences += 1

            rows.append(
                {
                    "grid_id": row["grid_id"],
                    "sci_name_list": json.dumps(filtered_species, separators=(",", ":")),
                }
            )

    stats = {
        "grid_cells": len(rows),
        "grid_unique_species": len(grid_unique_species),
        "grid_species_occurrences": grid_species_occurrences,
        "matched_unique_species": len(matched_unique_species),
        "matched_occurrences": matched_occurrences,
        "matched_cells": matched_cells,
    }
    return rows, stats


def write_output(rows: list[dict[str, object]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(output_path, "wt", encoding="utf-8") as handle:
        json.dump(rows, handle, separators=(",", ":"))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Filter grid species lists to species present in the traits table.",
    )
    parser.add_argument("grid_csv", type=Path)
    parser.add_argument("traits_csv", type=Path)
    parser.add_argument("output_gzip_json", type=Path)
    args = parser.parse_args()

    allowed_species = load_traits_species(args.traits_csv)
    rows, stats = filter_grid_rows(args.grid_csv, allowed_species)
    write_output(rows, args.output_gzip_json)

    print(f"traits_unique_species {len(allowed_species)}")
    for key, value in stats.items():
        print(f"{key} {value}")
    print(f"output_path {args.output_gzip_json}")


if __name__ == "__main__":
    main()
