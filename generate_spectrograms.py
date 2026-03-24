#!/usr/bin/env python3
"""
Generate high-quality spectrograms for bird sound files.
Saves spectrograms as PNG images in the public/spectrograms directory.
"""

import os
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import librosa
import librosa.display
from pathlib import Path

# Configuration
SOUNDS_DIR = Path('public/sounds')
OUTPUT_DIR = Path('public/spectrograms')
SAMPLE_RATE = 22050  # Standard sample rate for audio analysis
N_FFT = 2048  # FFT window size
HOP_LENGTH = 512  # Hop length for STFT
N_MELS = 128  # Number of mel bands

# Create output directory
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def generate_spectrogram(audio_path, output_path):
    """
    Generate a high-quality mel spectrogram for an audio file.

    Args:
        audio_path: Path to the input WAV file
        output_path: Path to save the output PNG file
    """
    # Load audio file
    y, sr = librosa.load(audio_path, sr=SAMPLE_RATE)

    # Compute mel spectrogram
    mel_spec = librosa.feature.melspectrogram(
        y=y,
        sr=sr,
        n_fft=N_FFT,
        hop_length=HOP_LENGTH,
        n_mels=N_MELS,
        fmax=8000  # Focus on bird vocalizations (most energy below 8kHz)
    )

    # Convert to dB scale
    mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)

    # Create figure with specific size for web display
    fig, ax = plt.subplots(figsize=(10, 4), dpi=150)

    # Plot spectrogram
    img = librosa.display.specshow(
        mel_spec_db,
        x_axis='time',
        y_axis='mel',
        sr=sr,
        hop_length=HOP_LENGTH,
        fmax=8000,
        ax=ax,
        cmap='magma'  # Beautiful colormap for spectrograms
    )

    # Add colorbar
    cbar = fig.colorbar(img, ax=ax, format='%+2.0f dB')
    cbar.ax.tick_params(labelsize=10)

    # Styling
    ax.set_xlabel('Time (s)', fontsize=11, fontweight='bold')
    ax.set_ylabel('Frequency (Hz)', fontsize=11, fontweight='bold')
    ax.tick_params(labelsize=9)

    # Remove top and right spines for cleaner look
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    # Tight layout
    plt.tight_layout()

    # Save with high quality
    plt.savefig(
        output_path,
        dpi=150,
        bbox_inches='tight',
        facecolor='black',
        edgecolor='none'
    )
    plt.close(fig)

    print(f"✓ Generated spectrogram: {output_path.name}")

def main():
    """Process all WAV files in the sounds directory."""

    # Get all WAV files
    wav_files = sorted(SOUNDS_DIR.glob('*.wav'))

    if not wav_files:
        print(f"No WAV files found in {SOUNDS_DIR}")
        return

    print(f"Found {len(wav_files)} WAV files")
    print(f"Generating spectrograms to {OUTPUT_DIR}\n")

    # Process each file
    for i, wav_path in enumerate(wav_files, 1):
        # Create output filename (same name but .png)
        output_filename = wav_path.stem + '.png'
        output_path = OUTPUT_DIR / output_filename

        print(f"[{i}/{len(wav_files)}] Processing {wav_path.name}...")

        try:
            generate_spectrogram(wav_path, output_path)
        except Exception as e:
            print(f"✗ Error processing {wav_path.name}: {e}")

    print(f"\n✓ Complete! Generated {len(wav_files)} spectrograms in {OUTPUT_DIR}")

if __name__ == '__main__':
    main()
