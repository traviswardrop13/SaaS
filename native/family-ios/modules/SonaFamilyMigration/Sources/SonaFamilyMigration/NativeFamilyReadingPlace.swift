import Foundation

/// A local bookmark for the native reader. The legacy read flag and speech
/// progress remain in their original stores.
public struct NativeFamilyReadingPlace: Codable, Equatable, Sendable {
    public let page: Int
    public let finished: Bool

    public init(page: Int, finished: Bool) {
        self.page = page
        self.finished = finished
    }

    static func valid(id: String, page: Int) -> Bool {
        !id.isEmpty && id.count <= 160 && (0...99).contains(page)
    }
}

public extension NativeFamilyRepository {
    func recordReadingPlace(_ place: NativeFamilyReadingPlace, bookID: String, owner: NativeFamilyChildID) throws {
        try change { document in
            guard document.origins[owner.origin.rawValue]?.slots.contains(owner.slot) == true else {
                throw NativeFamilyRepositoryError.childNotFound
            }
            guard NativeFamilyReadingPlace.valid(id: bookID, page: place.page) else {
                throw NativeFamilyRepositoryError.invalidChildKey
            }
            var places = document.readingPlaces ?? [:]
            places[owner, default: [:]][bookID] = place
            document.readingPlaces = places
        }
    }

}

extension NativeFamilyRepository {
    static func validGameID(_ id: String) -> Bool {
        id.range(of: "^[a-z][a-z0-9-]{0,39}$", options: .regularExpression) != nil
    }
}
