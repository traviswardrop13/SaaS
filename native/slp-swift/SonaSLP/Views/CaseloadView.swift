import UIKit
import SwiftUI

/// Every child, oldest-practiced first by default, with search and the
/// web's three filters. A row opens the child's page.
struct CaseloadView: View {
    @Environment(AppModel.self) private var model
    @Binding var chatOpen: Bool
    @State private var search = ""
    @State private var filter = "all"
    @State private var showArchived = false
    @State private var adding = false

    var body: some View {
        NavigationStack {
            List {
                Picker("Show", selection: $filter) {
                    Text("All").tag("all"); Text("Needs attention").tag("attention"); Text("Practiced").tag("week")
                }.pickerStyle(.segmented).listRowBackground(Color.clear)
                if shown.isEmpty {
                    Text(model.kids.isEmpty ? "No children yet. Add a family and they appear here once they join." : "No children match.")
                        .foregroundStyle(Color.sonaMuted)
                }
                ForEach(shown) { k in
                    NavigationLink(value: k.childId) {
                        KidRow(kid: k, detail: line(k))
                    }
                }
                Toggle("Show archived", isOn: $showArchived).font(.subheadline)
            }
            .searchable(text: $search, prompt: "Search by name")
            .refreshable { await model.load() }
            .navigationTitle("Caseload")
            .navigationDestination(for: String.self) { id in ChildView(childId: id) }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { ChatButton(open: $chatOpen) }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { adding = true } label: { Image(systemName: "person.badge.plus") }.accessibilityLabel("Add a family")
                }
            }
            .sheet(isPresented: $adding) { AddFamilyView() }
        }
    }

    private func attention(_ k: Kid) -> Bool { k.hwStatus == "missed" || k.quiet }

    private var shown: [Kid] {
        let q = search.trimmingCharacters(in: .whitespaces).lowercased()
        return model.kids
            .filter { showArchived || !$0.archived }
            .filter { q.isEmpty || $0.name.lowercased().contains(q) }
            .filter { filter == "all" || (filter == "attention" && attention($0)) || (filter == "week" && $0.week.days > 0) }
            .sorted { a, b in
                // Oldest practice first: the children to check on lead.
                let x = a.lastPracticed, y = b.lastPracticed
                if x.isEmpty != y.isEmpty { return x.isEmpty }
                return x < y
            }
    }

    private func line(_ k: Kid) -> String {
        var parts: [String] = []
        if !k.ageText.isEmpty { parts.append("age \(k.ageText)") }
        if k.synced == false { parts.append("just joined") }
        else { parts.append(k.lastPracticed.isEmpty ? "not practiced yet" : "practiced \(Day.ago(k.lastPracticed))") }
        parts.append("\(k.week.days)/7 days")
        if k.archived { parts.append("archived") }
        return parts.joined(separator: " · ")
    }
}

/// One child: the last 7 and 14 days, eight weeks of practice, homework, and
/// the note to copy. A pass rate only from SMALL_N attempts up.
struct ChildView: View {
    @Environment(AppModel.self) private var model
    let childId: String
    @State private var copied = false

    var body: some View {
        if let k = model.kids.first(where: { $0.childId == childId }) {
            List {
                Section {
                    stat("Last practiced", k.lastPracticed.isEmpty ? "Not yet" : Day.ago(k.lastPracticed))
                    stat("Last 7 days", "\(k.week.days) of 7 days · \(k.week.reps) words said")
                    let two = k.twoWeeks
                    stat("Pass rate, 14 days", two.attempts >= SMALL_N ? "\(two.rate ?? 0)% (n=\(two.attempts))" : two.attempts > 0 ? "Too few to read (n=\(two.attempts))" : "—")
                    if !k.targets.isEmpty { stat("Target", k.targets.map(soundLabel).joined(separator: ", ")) }
                } footer: { Text("Pass rate means \"did that sound like this sound\", from at-home listening on the family's device.") }

                Section("Homework") {
                    if let hw = k.hw?.hw, k.hwStatus != "none" {
                        stat("Status", k.hwStatus.capitalized)
                        if let s = hw.sounds, !s.isEmpty { stat("Sounds", s.map(soundLabel).joined(separator: ", ") + (hw.pos.flatMap { POSITION[$0] }.map { " · \($0)" } ?? "")) }
                        if let due = hw.due { stat("Until", Day.nice(due)) }
                        if let r = hw.repsPerDay { stat("A day", "\(r) tries") }
                    } else {
                        Text("No homework. Assign it from the dashboard on the web.").foregroundStyle(Color.sonaMuted)
                    }
                }

                Section("Last 8 weeks") {
                    ForEach(weeks(k)) { row in
                        HStack {
                            Text(row.label).frame(width: 90, alignment: .leading)
                            ProgressView(value: Double(row.days), total: 7).tint(.sonaTeal)
                            Text("\(row.days)/7").font(.caption.monospacedDigit()).frame(width: 34, alignment: .trailing)
                        }
                    }
                }

                Section {
                    Button(copied ? "Copied ✓" : "Copy note") {
                        UIPasteboard.general.string = k.note; copied = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { copied = false }
                    }
                } footer: { Text(k.note).font(.caption) }
            }
            .navigationTitle(k.name)
            .refreshable { await model.load() }
        } else {
            Text("This child is no longer on your caseload.").foregroundStyle(Color.sonaMuted)
        }
    }

    private func stat(_ label: String, _ value: String) -> some View {
        HStack { Text(label).foregroundStyle(Color.sonaMuted); Spacer(); Text(value).multilineTextAlignment(.trailing) }
    }

    /// Monday-start weeks, this week last, as days practiced of 7.
    struct WeekRow: Identifiable { let id: Int; let label: String; let days: Int }
    private func weeks(_ k: Kid) -> [WeekRow] {
        let t = Day.today()
        let weekday = Calendar(identifier: .gregorian).component(.weekday, from: Date()) // Sunday = 1
        let monday = Day.add(t, -((weekday + 5) % 7))
        return (0...7).reversed().map { w in
            let from = Day.add(monday, -7 * w)
            return WeekRow(id: w, label: w == 0 ? "This week" : Day.nice(from), days: k.window(from, Day.add(from, 6)).days)
        }
    }
}
