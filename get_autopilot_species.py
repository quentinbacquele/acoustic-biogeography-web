#!/usr/bin/env python3
"""
Extract the species selected by the autopilot feature
"""
import json
import gzip
import pandas as pd

# Load the CSV file to get file_name column
print("Loading CSV file for file_name lookup...")
csv_df = pd.read_csv('public/data/traits_data_pc_gmm_8components_proba.csv')
print(f"Loaded CSV with {len(csv_df)} rows")

# Load the traits data from JSON
print("Loading traits data from JSON...")
with gzip.open('public/data/ultra_optimized/traits_data_minimal.json.gz', 'rt') as f:
    traits_data = json.load(f)

print(f"Loaded {len(traits_data)} species records")

# Motif names
motif_names = [
    'Flat Whistles',
    'Slow Trills',
    'Fast Trills',
    'Chaotic Notes',
    'Ultrafast Trills',
    'Slow Mod. Whistles',
    'Fast Mod. Whistles',
    'Harmonic Stacks'
]

# Find autopilot targets
all_targets = []

for motif_idx in range(8):
    prob_key = f'prob_{motif_idx}'

    # Filter and sort by probability for this motif
    valid_species = [
        s for s in traits_data
        if prob_key in s and s[prob_key] is not None and not (
            isinstance(s[prob_key], float) and s[prob_key] != s[prob_key]  # Check for NaN
        )
    ]

    sorted_species = sorted(
        valid_species,
        key=lambda s: s[prob_key],
        reverse=True
    )

    # Take top 3 unique species
    selected_species = []
    seen_species = set()

    for species in sorted_species:
        species_name = species.get('species', 'Unknown')
        if species_name not in seen_species:
            selected_species.append(species)
            seen_species.add(species_name)

            if len(selected_species) == 3:
                break

    # Add to targets
    for species in selected_species:
        species_name = species.get('species', 'Unknown')

        # Find matching row in CSV to get file_name
        matching_rows = csv_df[csv_df['species'] == species_name]

        if len(matching_rows) > 0:
            # Get the first match (should be unique per species)
            file_name = matching_rows.iloc[0]['file_name']
        else:
            file_name = 'NOT_FOUND'
            print(f"WARNING: Could not find file_name for species: {species_name}")

        all_targets.append({
            'motif': motif_idx,
            'motif_name': motif_names[motif_idx],
            'full_data': species,
            'file_name': file_name
        })

# Write output
output_file = 'autopilot_selected_species.txt'
with open(output_file, 'w') as f:
    f.write('AUTOPILOT SELECTED SPECIES\n')
    f.write('=' * 80 + '\n\n')

    for motif_idx in range(8):
        motif_targets = [t for t in all_targets if t['motif'] == motif_idx]

        f.write(f"MOTIF {motif_idx}: {motif_names[motif_idx]}\n")
        f.write('-' * 80 + '\n')

        for i, target in enumerate(motif_targets, 1):
            data = target['full_data']
            prob_key = f"prob_{motif_idx}"
            file_name = target.get('file_name', 'NOT_FOUND')

            f.write(f"{i}. Species: {data.get('species', 'Unknown')}\n")
            f.write(f"   Family: {data.get('family', 'Unknown')}\n")
            f.write(f"   File: {file_name}\n")
            f.write(f"   Probability: {data.get(prob_key, 0) * 100:.1f}%\n")

            # Write ALL fields from the data
            f.write(f"   ALL DATA FIELDS:\n")
            for key, value in sorted(data.items()):
                if key not in ['species', 'family', prob_key]:
                    f.write(f"      {key}: {value}\n")
            f.write('\n')

        f.write('\n')

    f.write(f"Total species selected: {len(all_targets)}\n")

print(f"\n✓ Results saved to: {output_file}")
print(f"Total species selected: {len(all_targets)}")

# Also print to console
print("\n" + "=" * 80)
for motif_idx in range(8):
    motif_targets = [t for t in all_targets if t['motif'] == motif_idx]
    print(f"\n{motif_names[motif_idx]}:")
    for i, target in enumerate(motif_targets, 1):
        data = target['full_data']
        prob_key = f"prob_{motif_idx}"
        file_name = target.get('file_name', 'NOT_FOUND')
        print(f"  {i}. {data.get('species', 'Unknown')} - {data.get(prob_key, 0) * 100:.1f}%")
        print(f"     File: {file_name}")
