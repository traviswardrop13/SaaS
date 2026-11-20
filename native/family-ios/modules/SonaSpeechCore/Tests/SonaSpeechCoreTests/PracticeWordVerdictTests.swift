import XCTest
@testable import SonaSpeechCore

final class PracticeWordVerdictTests: XCTestCase {
    // Synthetic transcripts only. Expectations were evaluated from the unchanged
    // public/sona.js HEAR2 implementation. First 52 entries are every V()
    // case in tests/heartest.mjs's verdict sections; the rest cover all sounds,
    // plural/possessive handling, coaching, fillers and token normalization.
    func testShippingJavaScriptParity() {
        for (index, fixture) in Self.fixtures.enumerated() {
            XCTAssertEqual(PracticeWordVerdict.evaluate(
                transcript: fixture.text, sound: fixture.sound, word: fixture.word,
                level: fixture.level, frame: fixture.frame
            ), fixture.expected, "Fixture \(index + 1): \(fixture.sound), \(fixture.text) for \(fixture.word)")
        }
    }

    private struct Fixture {
        var text: String
        var sound: String
        var word: String
        var level: String?
        var frame: String?
        var expected: PracticeWordVerdict
    }
    private static let fixtures: [Fixture] = [
        .init(text: "poopoo", sound: "R", word: "", level: nil, frame: nil, expected: .fail), // 1
        .init(text: "poo poo", sound: "R", word: "rabbit", level: nil, frame: nil, expected: .fail), // 2
        .init(text: "banana banana", sound: "R", word: "rain", level: nil, frame: nil, expected: .fail), // 3
        .init(text: "rabbit", sound: "R", word: "rabbit", level: nil, frame: nil, expected: .pass), // 4
        .init(text: "wabbit", sound: "R", word: "rabbit", level: nil, frame: nil, expected: .pass), // 5
        .init(text: "the rabbit", sound: "R", word: "rabbit", level: nil, frame: nil, expected: .pass), // 6
        .init(text: "run", sound: "R", word: "rain", level: nil, frame: nil, expected: .fail), // 7
        .init(text: "rocket", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .fail), // 8
        .init(text: "rainy", sound: "R", word: "rain", level: "word", frame: nil, expected: .pass), // 9
        .init(text: "are", sound: "R", word: "", level: nil, frame: nil, expected: .pass), // 10
        .init(text: "ship", sound: "SH", word: "", level: nil, frame: nil, expected: .pass), // 11
        .init(text: "sip", sound: "SH", word: "", level: nil, frame: nil, expected: .fail), // 12
        .init(text: "this", sound: "TH", word: "", level: nil, frame: nil, expected: .pass), // 13
        .init(text: "", sound: "R", word: "rabbit", level: nil, frame: nil, expected: .unknown), // 14
        .init(text: "   ", sound: "R", word: "rabbit", level: nil, frame: nil, expected: .unknown), // 15
        .init(text: "...!!", sound: "R", word: "rabbit", level: nil, frame: nil, expected: .unknown), // 16
        .init(text: "bat", sound: "R", word: "bar", level: nil, frame: nil, expected: .fail), // 17
        .init(text: "taco", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .fail), // 18
        .init(text: "water", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .fail), // 19
        .init(text: "here is a taco", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .fail), // 20
        .init(text: "Here is a taco.", sound: "R", word: "rabbit", level: "sentence", frame: "Here is a rabbit.", expected: .fail), // 21
        .init(text: "Here is a rabbit.", sound: "R", word: "rabbit", level: "sentence", frame: "Here is a rabbit.", expected: .pass), // 22
        .init(text: "here is a", sound: "R", word: "rabbit", level: "sentence", frame: "Here is a rabbit.", expected: .unknown), // 23
        .init(text: "I see a taco", sound: "S", word: "sun", level: "sentence", frame: "I see a sun.", expected: .fail), // 24
        .init(text: "sock", sound: "R", word: "rock", level: "word", frame: nil, expected: .fail), // 25
        .init(text: "sing", sound: "R", word: "ring", level: "word", frame: nil, expected: .fail), // 26
        .init(text: "wock", sound: "R", word: "rock", level: "word", frame: nil, expected: .pass), // 27
        .init(text: "wed", sound: "R", word: "red", level: "word", frame: nil, expected: .pass), // 28
        .init(text: "bed", sound: "R", word: "red", level: "word", frame: nil, expected: .fail), // 29
        .init(text: "cah", sound: "R", word: "car", level: "word", frame: nil, expected: .pass), // 30
        .init(text: "tat", sound: "K", word: "cat", level: "word", frame: nil, expected: .pass), // 31
        .init(text: "sip", sound: "SH", word: "ship", level: "word", frame: nil, expected: .pass), // 32
        .init(text: "4", sound: "R", word: "four", level: "word", frame: nil, expected: .pass), // 33
        .init(text: "say rabbit taco", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .fail), // 34
        .init(text: "say rabbit rabbit", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .pass), // 35
        .init(text: "poop", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .fail), // 36
        .init(text: "fridge", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .fail), // 37
        .init(text: "fridge", sound: "R", word: "carrot", level: "word", frame: nil, expected: .fail), // 38
        .init(text: "tractor", sound: "R", word: "car", level: "word", frame: nil, expected: .fail), // 39
        .init(text: "parrot", sound: "R", word: "carrot", level: "word", frame: nil, expected: .pass), // 40
        .init(text: "cawwot", sound: "R", word: "carrot", level: "word", frame: nil, expected: .pass), // 41
        .init(text: "cannot", sound: "R", word: "carrot", level: "word", frame: nil, expected: .fail), // 42
        .init(text: "uh", sound: "R", word: "rrrr", level: "isolation", frame: nil, expected: .unknown), // 43
        .init(text: "Er", sound: "R", word: "rrrr", level: "isolation", frame: nil, expected: .pass), // 44
        .init(text: "taco", sound: "R", word: "rrrr", level: "isolation", frame: nil, expected: .fail), // 45
        .init(text: "fridge", sound: "R", word: "rrrr", level: "isolation", frame: nil, expected: .fail), // 46
        .init(text: "Rrrrrr", sound: "R", word: "rrrr", level: "isolation", frame: nil, expected: .pass), // 47
        .init(text: "Error", sound: "R", word: "rrrr", level: "isolation", frame: nil, expected: .pass), // 48
        .init(text: "taco", sound: "K", word: "kuh", level: "isolation", frame: nil, expected: .fail), // 49
        .init(text: "wah", sound: "R", word: "rah", level: "syllable", frame: nil, expected: .pass), // 50
        .init(text: "ah", sound: "R", word: "rah", level: "syllable", frame: nil, expected: .unknown), // 51
        .init(text: "taco", sound: "R", word: "rah", level: "syllable", frame: nil, expected: .fail), // 52
        .init(text: "rabbit", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .pass), // 53
        .init(text: "say rabbit", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .unknown), // 54
        .init(text: "uh", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .unknown), // 55
        .init(text: "rabbits", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .pass), // 56
        .init(text: "rabbites", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .pass), // 57
        .init(text: "rabbit's", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .pass), // 58
        .init(text: "wabbit", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .pass), // 59
        .init(text: "taco", sound: "R", word: "rabbit", level: "word", frame: nil, expected: .fail), // 60
        .init(text: "lion", sound: "L", word: "lion", level: "word", frame: nil, expected: .pass), // 61
        .init(text: "say lion", sound: "L", word: "lion", level: "word", frame: nil, expected: .unknown), // 62
        .init(text: "uh", sound: "L", word: "lion", level: "word", frame: nil, expected: .unknown), // 63
        .init(text: "lions", sound: "L", word: "lion", level: "word", frame: nil, expected: .pass), // 64
        .init(text: "liones", sound: "L", word: "lion", level: "word", frame: nil, expected: .pass), // 65
        .init(text: "lion's", sound: "L", word: "lion", level: "word", frame: nil, expected: .pass), // 66
        .init(text: "wion", sound: "L", word: "lion", level: "word", frame: nil, expected: .pass), // 67
        .init(text: "taco", sound: "L", word: "lion", level: "word", frame: nil, expected: .fail), // 68
        .init(text: "sun", sound: "S", word: "sun", level: "word", frame: nil, expected: .pass), // 69
        .init(text: "say sun", sound: "S", word: "sun", level: "word", frame: nil, expected: .unknown), // 70
        .init(text: "uh", sound: "S", word: "sun", level: "word", frame: nil, expected: .unknown), // 71
        .init(text: "suns", sound: "S", word: "sun", level: "word", frame: nil, expected: .pass), // 72
        .init(text: "sunes", sound: "S", word: "sun", level: "word", frame: nil, expected: .pass), // 73
        .init(text: "sun's", sound: "S", word: "sun", level: "word", frame: nil, expected: .pass), // 74
        .init(text: "thun", sound: "S", word: "sun", level: "word", frame: nil, expected: .pass), // 75
        .init(text: "taco", sound: "S", word: "sun", level: "word", frame: nil, expected: .fail), // 76
        .init(text: "zoo", sound: "Z", word: "zoo", level: "word", frame: nil, expected: .pass), // 77
        .init(text: "say zoo", sound: "Z", word: "zoo", level: "word", frame: nil, expected: .unknown), // 78
        .init(text: "uh", sound: "Z", word: "zoo", level: "word", frame: nil, expected: .unknown), // 79
        .init(text: "zoos", sound: "Z", word: "zoo", level: "word", frame: nil, expected: .pass), // 80
        .init(text: "zooes", sound: "Z", word: "zoo", level: "word", frame: nil, expected: .pass), // 81
        .init(text: "zoo's", sound: "Z", word: "zoo", level: "word", frame: nil, expected: .pass), // 82
        .init(text: "doo", sound: "Z", word: "zoo", level: "word", frame: nil, expected: .pass), // 83
        .init(text: "taco", sound: "Z", word: "zoo", level: "word", frame: nil, expected: .fail), // 84
        .init(text: "ship", sound: "SH", word: "ship", level: "word", frame: nil, expected: .pass), // 85
        .init(text: "say ship", sound: "SH", word: "ship", level: "word", frame: nil, expected: .unknown), // 86
        .init(text: "uh", sound: "SH", word: "ship", level: "word", frame: nil, expected: .unknown), // 87
        .init(text: "ships", sound: "SH", word: "ship", level: "word", frame: nil, expected: .pass), // 88
        .init(text: "shipes", sound: "SH", word: "ship", level: "word", frame: nil, expected: .pass), // 89
        .init(text: "ship's", sound: "SH", word: "ship", level: "word", frame: nil, expected: .pass), // 90
        .init(text: "sip", sound: "SH", word: "ship", level: "word", frame: nil, expected: .pass), // 91
        .init(text: "taco", sound: "SH", word: "ship", level: "word", frame: nil, expected: .fail), // 92
        .init(text: "chair", sound: "CH", word: "chair", level: "word", frame: nil, expected: .pass), // 93
        .init(text: "say chair", sound: "CH", word: "chair", level: "word", frame: nil, expected: .unknown), // 94
        .init(text: "uh", sound: "CH", word: "chair", level: "word", frame: nil, expected: .unknown), // 95
        .init(text: "chairs", sound: "CH", word: "chair", level: "word", frame: nil, expected: .pass), // 96
        .init(text: "chaires", sound: "CH", word: "chair", level: "word", frame: nil, expected: .pass), // 97
        .init(text: "chair's", sound: "CH", word: "chair", level: "word", frame: nil, expected: .pass), // 98
        .init(text: "shair", sound: "CH", word: "chair", level: "word", frame: nil, expected: .pass), // 99
        .init(text: "taco", sound: "CH", word: "chair", level: "word", frame: nil, expected: .fail), // 100
        .init(text: "jam", sound: "J", word: "jam", level: "word", frame: nil, expected: .pass), // 101
        .init(text: "say jam", sound: "J", word: "jam", level: "word", frame: nil, expected: .unknown), // 102
        .init(text: "uh", sound: "J", word: "jam", level: "word", frame: nil, expected: .unknown), // 103
        .init(text: "jams", sound: "J", word: "jam", level: "word", frame: nil, expected: .pass), // 104
        .init(text: "james", sound: "J", word: "jam", level: "word", frame: nil, expected: .pass), // 105
        .init(text: "jam's", sound: "J", word: "jam", level: "word", frame: nil, expected: .pass), // 106
        .init(text: "dam", sound: "J", word: "jam", level: "word", frame: nil, expected: .pass), // 107
        .init(text: "taco", sound: "J", word: "jam", level: "word", frame: nil, expected: .fail), // 108
        .init(text: "cat", sound: "K", word: "cat", level: "word", frame: nil, expected: .pass), // 109
        .init(text: "say cat", sound: "K", word: "cat", level: "word", frame: nil, expected: .unknown), // 110
        .init(text: "uh", sound: "K", word: "cat", level: "word", frame: nil, expected: .unknown), // 111
        .init(text: "cats", sound: "K", word: "cat", level: "word", frame: nil, expected: .pass), // 112
        .init(text: "cates", sound: "K", word: "cat", level: "word", frame: nil, expected: .pass), // 113
        .init(text: "cat's", sound: "K", word: "cat", level: "word", frame: nil, expected: .pass), // 114
        .init(text: "tat", sound: "K", word: "cat", level: "word", frame: nil, expected: .pass), // 115
        .init(text: "taco", sound: "K", word: "cat", level: "word", frame: nil, expected: .fail), // 116
        .init(text: "goat", sound: "G", word: "goat", level: "word", frame: nil, expected: .pass), // 117
        .init(text: "say goat", sound: "G", word: "goat", level: "word", frame: nil, expected: .unknown), // 118
        .init(text: "uh", sound: "G", word: "goat", level: "word", frame: nil, expected: .unknown), // 119
        .init(text: "goats", sound: "G", word: "goat", level: "word", frame: nil, expected: .pass), // 120
        .init(text: "goates", sound: "G", word: "goat", level: "word", frame: nil, expected: .pass), // 121
        .init(text: "goat's", sound: "G", word: "goat", level: "word", frame: nil, expected: .pass), // 122
        .init(text: "doat", sound: "G", word: "goat", level: "word", frame: nil, expected: .pass), // 123
        .init(text: "taco", sound: "G", word: "goat", level: "word", frame: nil, expected: .fail), // 124
        .init(text: "phone", sound: "F", word: "phone", level: "word", frame: nil, expected: .pass), // 125
        .init(text: "say phone", sound: "F", word: "phone", level: "word", frame: nil, expected: .unknown), // 126
        .init(text: "uh", sound: "F", word: "phone", level: "word", frame: nil, expected: .unknown), // 127
        .init(text: "phones", sound: "F", word: "phone", level: "word", frame: nil, expected: .pass), // 128
        .init(text: "phonees", sound: "F", word: "phone", level: "word", frame: nil, expected: .pass), // 129
        .init(text: "phone's", sound: "F", word: "phone", level: "word", frame: nil, expected: .pass), // 130
        .init(text: "pone", sound: "F", word: "phone", level: "word", frame: nil, expected: .pass), // 131
        .init(text: "taco", sound: "F", word: "phone", level: "word", frame: nil, expected: .fail), // 132
        .init(text: "van", sound: "V", word: "van", level: "word", frame: nil, expected: .pass), // 133
        .init(text: "say van", sound: "V", word: "van", level: "word", frame: nil, expected: .unknown), // 134
        .init(text: "uh", sound: "V", word: "van", level: "word", frame: nil, expected: .unknown), // 135
        .init(text: "vans", sound: "V", word: "van", level: "word", frame: nil, expected: .pass), // 136
        .init(text: "vanes", sound: "V", word: "van", level: "word", frame: nil, expected: .pass), // 137
        .init(text: "van's", sound: "V", word: "van", level: "word", frame: nil, expected: .pass), // 138
        .init(text: "ban", sound: "V", word: "van", level: "word", frame: nil, expected: .pass), // 139
        .init(text: "taco", sound: "V", word: "van", level: "word", frame: nil, expected: .fail), // 140
        .init(text: "thumb", sound: "TH", word: "thumb", level: "word", frame: nil, expected: .pass), // 141
        .init(text: "say thumb", sound: "TH", word: "thumb", level: "word", frame: nil, expected: .unknown), // 142
        .init(text: "uh", sound: "TH", word: "thumb", level: "word", frame: nil, expected: .unknown), // 143
        .init(text: "thumbs", sound: "TH", word: "thumb", level: "word", frame: nil, expected: .pass), // 144
        .init(text: "thumbes", sound: "TH", word: "thumb", level: "word", frame: nil, expected: .pass), // 145
        .init(text: "thumb's", sound: "TH", word: "thumb", level: "word", frame: nil, expected: .pass), // 146
        .init(text: "fum", sound: "TH", word: "thumb", level: "word", frame: nil, expected: .fail), // 147
        .init(text: "taco", sound: "TH", word: "thumb", level: "word", frame: nil, expected: .fail), // 148
        .init(text: "this", sound: "THV", word: "this", level: "word", frame: nil, expected: .pass), // 149
        .init(text: "say this", sound: "THV", word: "this", level: "word", frame: nil, expected: .unknown), // 150
        .init(text: "uh", sound: "THV", word: "this", level: "word", frame: nil, expected: .unknown), // 151
        .init(text: "thiss", sound: "THV", word: "this", level: "word", frame: nil, expected: .pass), // 152
        .init(text: "thises", sound: "THV", word: "this", level: "word", frame: nil, expected: .pass), // 153
        .init(text: "this's", sound: "THV", word: "this", level: "word", frame: nil, expected: .pass), // 154
        .init(text: "dis", sound: "THV", word: "this", level: "word", frame: nil, expected: .pass), // 155
        .init(text: "taco", sound: "THV", word: "this", level: "word", frame: nil, expected: .fail), // 156
        .init(text: "pig", sound: "P", word: "pig", level: "word", frame: nil, expected: .pass), // 157
        .init(text: "say pig", sound: "P", word: "pig", level: "word", frame: nil, expected: .unknown), // 158
        .init(text: "uh", sound: "P", word: "pig", level: "word", frame: nil, expected: .unknown), // 159
        .init(text: "pigs", sound: "P", word: "pig", level: "word", frame: nil, expected: .pass), // 160
        .init(text: "piges", sound: "P", word: "pig", level: "word", frame: nil, expected: .pass), // 161
        .init(text: "pig's", sound: "P", word: "pig", level: "word", frame: nil, expected: .pass), // 162
        .init(text: "taco", sound: "P", word: "pig", level: "word", frame: nil, expected: .fail), // 163
        .init(text: "ball", sound: "B", word: "ball", level: "word", frame: nil, expected: .pass), // 164
        .init(text: "say ball", sound: "B", word: "ball", level: "word", frame: nil, expected: .unknown), // 165
        .init(text: "uh", sound: "B", word: "ball", level: "word", frame: nil, expected: .unknown), // 166
        .init(text: "balls", sound: "B", word: "ball", level: "word", frame: nil, expected: .pass), // 167
        .init(text: "balles", sound: "B", word: "ball", level: "word", frame: nil, expected: .pass), // 168
        .init(text: "ball's", sound: "B", word: "ball", level: "word", frame: nil, expected: .pass), // 169
        .init(text: "taco", sound: "B", word: "ball", level: "word", frame: nil, expected: .fail), // 170
        .init(text: "moon", sound: "M", word: "moon", level: "word", frame: nil, expected: .pass), // 171
        .init(text: "say moon", sound: "M", word: "moon", level: "word", frame: nil, expected: .unknown), // 172
        .init(text: "uh", sound: "M", word: "moon", level: "word", frame: nil, expected: .unknown), // 173
        .init(text: "moons", sound: "M", word: "moon", level: "word", frame: nil, expected: .pass), // 174
        .init(text: "moones", sound: "M", word: "moon", level: "word", frame: nil, expected: .pass), // 175
        .init(text: "moon's", sound: "M", word: "moon", level: "word", frame: nil, expected: .pass), // 176
        .init(text: "taco", sound: "M", word: "moon", level: "word", frame: nil, expected: .fail), // 177
        .init(text: "nose", sound: "N", word: "nose", level: "word", frame: nil, expected: .pass), // 178
        .init(text: "say nose", sound: "N", word: "nose", level: "word", frame: nil, expected: .unknown), // 179
        .init(text: "uh", sound: "N", word: "nose", level: "word", frame: nil, expected: .unknown), // 180
        .init(text: "noses", sound: "N", word: "nose", level: "word", frame: nil, expected: .pass), // 181
        .init(text: "nosees", sound: "N", word: "nose", level: "word", frame: nil, expected: .pass), // 182
        .init(text: "nose's", sound: "N", word: "nose", level: "word", frame: nil, expected: .pass), // 183
        .init(text: "taco", sound: "N", word: "nose", level: "word", frame: nil, expected: .fail), // 184
        .init(text: "top", sound: "T", word: "top", level: "word", frame: nil, expected: .pass), // 185
        .init(text: "say top", sound: "T", word: "top", level: "word", frame: nil, expected: .unknown), // 186
        .init(text: "uh", sound: "T", word: "top", level: "word", frame: nil, expected: .unknown), // 187
        .init(text: "tops", sound: "T", word: "top", level: "word", frame: nil, expected: .pass), // 188
        .init(text: "topes", sound: "T", word: "top", level: "word", frame: nil, expected: .pass), // 189
        .init(text: "top's", sound: "T", word: "top", level: "word", frame: nil, expected: .pass), // 190
        .init(text: "taco", sound: "T", word: "top", level: "word", frame: nil, expected: .fail), // 191
        .init(text: "dog", sound: "D", word: "dog", level: "word", frame: nil, expected: .pass), // 192
        .init(text: "say dog", sound: "D", word: "dog", level: "word", frame: nil, expected: .unknown), // 193
        .init(text: "uh", sound: "D", word: "dog", level: "word", frame: nil, expected: .unknown), // 194
        .init(text: "dogs", sound: "D", word: "dog", level: "word", frame: nil, expected: .pass), // 195
        .init(text: "doges", sound: "D", word: "dog", level: "word", frame: nil, expected: .pass), // 196
        .init(text: "dog's", sound: "D", word: "dog", level: "word", frame: nil, expected: .pass), // 197
        .init(text: "taco", sound: "D", word: "dog", level: "word", frame: nil, expected: .fail), // 198
        .init(text: "wow", sound: "R", word: "rrrr", level: "isolation", frame: nil, expected: .fail), // 199
        .init(text: "shhhh", sound: "SH", word: "shhh", level: "isolation", frame: nil, expected: .pass), // 200
        .init(text: "shhhh", sound: "S", word: "sss", level: "isolation", frame: nil, expected: .fail), // 201
        .init(text: "RABBIT!", sound: "R", word: "rabbit", level: nil, frame: nil, expected: .pass), // 202
        .init(text: "'rabbit'", sound: "R", word: "rabbit", level: nil, frame: nil, expected: .pass), // 203
        .init(text: "said rabbit taco", sound: "R", word: "rabbit", level: nil, frame: nil, expected: .fail), // 204
        .init(text: "saying rabbit rabbit", sound: "R", word: "rabbit", level: nil, frame: nil, expected: .pass), // 205
        .init(text: "13", sound: "R", word: "four", level: nil, frame: nil, expected: .unknown), // 206
        .init(text: "0004", sound: "R", word: "four", level: nil, frame: nil, expected: .pass), // 207
        .init(text: "44", sound: "R", word: "four", level: nil, frame: nil, expected: .unknown), // 208
        .init(text: "0000000000000000000000000000000000000004", sound: "R", word: "four", level: nil, frame: nil, expected: .pass), // 209
        .init(text: "", sound: "NOPE", word: "", level: nil, frame: nil, expected: .unknown), // 210
        .init(text: "umm", sound: "NOPE", word: "", level: nil, frame: nil, expected: .unknown), // 211
        .init(text: "hello", sound: "NOPE", word: "", level: nil, frame: nil, expected: .fail), // 212
        .init(text: "r🌟abbit", sound: "R", word: "rabbit", level: nil, frame: nil, expected: .fail), // 213
        .init(text: "Here is a rabbit.", sound: "R", word: "rabbit", level: "sentence", frame: "Here is a rabbit.", expected: .pass), // 214
        .init(text: "Here is a", sound: "R", word: "rabbit", level: "sentence", frame: "Here is a rabbit.", expected: .unknown), // 215
    ]
}
