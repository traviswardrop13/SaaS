import SwiftUI

/// Today: the week at a glance, then the three questions a clinician asks
/// between sessions (the web's Today page): who went quiet, whose homework
/// ends soon or was missed, who practiced. No ranking, no caseload average.
struct TodayView: View {
    @Environment(AppModel.self) private var model
    @Binding var chatOpen: Bool
    @State private var adding = false

    var body: some View {
        NavigationStack {
            List {
                if let err = model.loadError {
                    Section { Label(err, systemImage: "wifi.exclamationmark").foregroundStyle(.red) }
                }
                Section { summary }
                if model.kids.isEmpty && model.invites.isEmpty && !model.loading {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Send your first family home with Sona").font(.headline)
                            Text("Add a family and they get a login for the Sona app by email.").foregroundStyle(Color.sonaMuted)
                            Button("Add a family") { adding = true }.buttonStyle(.borderedProminent).padding(.top, 4)
                        }.padding(.vertical, 6)
                    }
                } else {
                    group("Gone quiet", "A good place to check in.", quiet) { k in
                        k.lastPracticed.isEmpty ? "No practice yet" : "No practice for \(k.lastDaysAgo ?? 0) days"
                    }
                    group("Homework ending soon or missed", "Review the next step for home practice.", homework) { k in
                        k.hwStatus == "missed" ? "Missed: the daily target wasn't met on half the days" : "Ends \(Day.nice(k.due))"
                    }
                    group("Practiced in the last 7 days", "Small moments of practice, adding up.", practiced) { k in
                        "\(k.week.days) of 7 days · \(k.week.reps) words said"
                    }
                    if !model.invites.isEmpty {
                        Section {
                            ForEach(model.invites) { i in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(i.label ?? "New family").font(.body.weight(.medium))
                                    Text("Invited \(Day.ago(i.createdAt))" + ((i.expiresAt).map { " · deletes itself \(Day.nice($0))" } ?? ""))
                                        .font(.caption).foregroundStyle(Color.sonaMuted)
                                }
                            }
                        } header: { Text("Invited, not joined yet") }
                    }
                }
            }
            .refreshable { await model.load() }
            .navigationTitle(greeting)
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

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        let first = (model.me?.name ?? "").split(separator: " ").first.map(String.init) ?? ""
        let hi = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
        return first.isEmpty ? hi : "\(hi), \(first)"
    }

    private var practiced: [Kid] { model.liveKids.filter { $0.week.days > 0 }.sorted { $0.week.days > $1.week.days } }
    private var homework: [Kid] {
        let t = Day.today()
        return model.liveKids.filter { k in
            k.hwStatus == "missed" || (k.hwStatus == "active" && !k.due.isEmpty && (0...7).contains(Day.between(t, k.due)))
        }.sorted { ($0.hwStatus == "missed" ? 0 : 1, $0.due) < ($1.hwStatus == "missed" ? 0 : 1, $1.due) }
    }
    private var quiet: [Kid] {
        let hw = Set(homework.map(\.childId))
        return model.liveKids.filter { $0.quiet && !hw.contains($0.childId) }
            .sorted { ($0.lastDaysAgo ?? 9999) > ($1.lastDaysAgo ?? 9999) }
    }

    private var summary: some View {
        let live = model.liveKids.count, n = practiced.count
        return VStack(alignment: .leading, spacing: 8) {
            Text("Home practice, last 7 days").font(.caption.weight(.semibold)).foregroundStyle(Color.sonaMuted)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("\(n)").font(.system(size: 40, weight: .bold, design: .rounded)).foregroundStyle(Color.sonaTeal)
                Text("of \(live) children practiced").foregroundStyle(.primary)
            }
            ProgressView(value: live > 0 ? Double(n) / Double(live) : 0).tint(.sonaTeal)
        }
        .padding(.vertical, 6)
        .listRowBackground(Color.sonaButter.opacity(0.55))
    }

    @ViewBuilder
    private func group(_ title: String, _ caption: String, _ list: [Kid], why: @escaping (Kid) -> String) -> some View {
        Section {
            if list.isEmpty { Text("Nobody.").foregroundStyle(Color.sonaMuted) }
            ForEach(list.prefix(10)) { k in
                NavigationLink(value: k.childId) { KidRow(kid: k, detail: why(k)) }
            }
        } header: {
            HStack { Text(title); Spacer(); Text("\(list.count)") }
        } footer: { Text(caption) }
    }
}

struct KidRow: View {
    let kid: Kid
    let detail: String
    var body: some View {
        HStack(spacing: 12) {
            Text(String(kid.name.prefix(1)).uppercased())
                .font(.headline).frame(width: 36, height: 36)
                .background(Color.sonaButter, in: Circle()).foregroundStyle(Color.primary)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(kid.name).font(.body.weight(.medium))
                    if !kid.targets.isEmpty {
                        Text(kid.targets.map(soundLabel).joined(separator: ", "))
                            .font(.caption.weight(.semibold)).padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Color.sonaTeal.opacity(0.1), in: Capsule()).foregroundStyle(Color.sonaTeal)
                    }
                }
                Text(detail).font(.caption).foregroundStyle(Color.sonaMuted)
            }
        }
    }
}
