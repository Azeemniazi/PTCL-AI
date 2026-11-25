"""Read ZIP/RAR with libarchive. Entries are written to numeric staging paths only."""

import ctypes as c
import ctypes.util
import json
import mimetypes
import os
from pathlib import Path
import resource
import stat
import sys
import unicodedata

MIB = 1024**2
MAX_TOTAL = 2048 * MIB
MAX_ENTRIES = 1400


def read(source, extension, output):
    resource.setrlimit(resource.RLIMIT_AS, (512 * MIB, 512 * MIB))
    resource.setrlimit(resource.RLIMIT_CPU, (90, 95))
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_TOTAL, MAX_TOTAL))
    os.umask(0o077)
    library = ctypes.util.find_library("archive")
    if not library:
        raise ValueError("The ZIP and RAR reader is unavailable. Ask an administrator to install libarchive.")
    lib = c.CDLL(library)

    def bind(name, result, *arguments):
        function = getattr(lib, name)
        function.restype, function.argtypes = result, arguments
        return function

    pointer = c.c_void_p
    integer = c.c_int
    new = bind("archive_read_new", pointer)
    free = bind("archive_read_free", integer, pointer)
    open_archive = bind("archive_read_open_filename", integer, pointer, c.c_char_p, c.c_size_t)
    next_entry = bind("archive_read_next_header", integer, pointer, c.POINTER(pointer))
    error = bind("archive_error_string", c.c_char_p, pointer)
    pathname = bind("archive_entry_pathname_utf8", c.c_char_p, pointer)
    entry_type = bind("archive_entry_filetype", c.c_uint, pointer)
    size = bind("archive_entry_size", c.c_int64, pointer)
    link = bind("archive_entry_hardlink", c.c_char_p, pointer)
    encrypted = bind("archive_entry_is_encrypted", integer, pointer)
    read_data = bind("archive_read_data", c.c_ssize_t, pointer, pointer, c.c_size_t)

    archive = new()
    if not archive:
        raise ValueError("The archive reader could not start.")

    def check(result):
        if result >= 0:
            return result
        detail = (error(archive) or b"").decode("utf8", "replace").lower()
        if any(word in detail for word in ("encrypt", "password", "passphrase")):
            raise ValueError("This archive is encrypted. Upload an unlocked ZIP or RAR.")
        if any(word in detail for word in ("volume", "multi-part", "multi-disk", "split")):
            raise ValueError("Split archives are unsupported. Combine the volumes into a single archive.")
        raise ValueError("This archive is damaged or uses an unsupported ZIP or RAR format.")

    directories, files, total = [], [], 0
    try:
        formats = ["zip"] if extension == "zip" else ["rar", "rar5"]
        for format_name in formats:
            check(bind("archive_read_support_format_" + format_name, integer, pointer)(archive))
        check(open_archive(archive, os.fsencode(source), 65536))
        entry = pointer()
        buffer = c.create_string_buffer(65536)
        while check(next_entry(archive, c.byref(entry))) != 1:
            if len(files) + len(directories) >= MAX_ENTRIES:
                raise ValueError("An archive can contain up to 1,400 entries.")
            if encrypted(entry) > 0:
                raise ValueError("This archive is encrypted. Upload an unlocked ZIP or RAR.")
            kind = entry_type(entry)
            if kind not in (stat.S_IFDIR, stat.S_IFREG) or link(entry):
                raise ValueError("Archives can contain only regular files and folders.")
            raw = pathname(entry)
            if raw is None:
                raise ValueError("The archive contains an unreadable filename.")
            name = unicodedata.normalize("NFC", raw.decode("utf8"))
            if kind == stat.S_IFDIR:
                name = name.removesuffix("/")
                directories.append(name)
                continue
            length = size(entry)
            total += length
            if length < 0 or total > MAX_TOTAL:
                raise ValueError("Expanded archives are limited to 2 GiB in total.")
            if output:
                written = 0
                with (Path(output) / str(len(files))).open("xb") as target:
                    while count := check(read_data(archive, buffer, len(buffer))):
                        written += count
                        if written > length:
                            raise ValueError("An archived file exceeds its declared size.")
                        target.write(buffer.raw[:count])
                if written != length:
                    raise ValueError("An archived file is incomplete.")
            mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
            files.append({"path": name, "size": length, "type": mime})
    finally:
        free(archive)
    return {"directories": directories, "files": files, "size": total}


if __name__ == "__main__":
    try:
        print(json.dumps(read(*sys.argv[1:]), ensure_ascii=True))
    except (ValueError, UnicodeError) as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)
